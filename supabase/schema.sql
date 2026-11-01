-- ==========================================
-- 0. 开启必要扩展
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. 数据表结构设计
-- ==========================================

-- 表 1：students（学员表）
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    avatar_url TEXT DEFAULT 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
    passcode TEXT UNIQUE NOT NULL, -- 专属家庭访问码，如 "BEN2026"
    remaining_hours NUMERIC(5, 1) DEFAULT 0 CHECK (remaining_hours >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 表 2：curriculum_weeks（教学周次/课程表）
CREATE TABLE IF NOT EXISTS public.curriculum_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_code TEXT UNIQUE NOT NULL, -- 如 "2026-W44"
    title TEXT NOT NULL,            -- 课程主题，如“向日葵与星空”
    theme_desc TEXT,                -- 技法与要点说明
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 表 3：artworks（作品档案表）
CREATE TABLE IF NOT EXISTS public.artworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    week_id UUID NOT NULL REFERENCES public.curriculum_weeks(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT '最终成作' CHECK (stage IN ('草图构思', '色彩打底', '最终成作')),
    teacher_comment TEXT,
    audio_comment_url TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 表 4：comments（互动评论与点赞表）
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artwork_id UUID NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL CHECK (char_length(trim(author_name)) BETWEEN 1 AND 30),
    author_role TEXT NOT NULL DEFAULT 'parent' CHECK (author_role IN ('teacher', 'parent')),
    content TEXT NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 高频查询索引优化
CREATE INDEX IF NOT EXISTS idx_students_passcode ON public.students(UPPER(passcode));
CREATE INDEX IF NOT EXISTS idx_artworks_student_created ON public.artworks(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artworks_week_created ON public.artworks(week_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_artwork_created ON public.comments(artwork_id, created_at ASC);

-- ==========================================
-- 2. 开启 Realtime 实时订阅 (用于评论抽屉多端同步)
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.artworks;

-- ==========================================
-- 3. 存储桶配置 (Storage Bucket: artworks-storage)
-- ==========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'artworks-storage',
    'artworks-storage',
    true,
    10485760, -- 10MB 上限
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/webm']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ==========================================
-- 4. 行级安全策略 (RLS - Row Level Security)
-- ==========================================
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 4.1 公共只读策略 (允许前端 anon 与 authenticated 直接读取)
CREATE POLICY "Public Read Students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Public Read Curriculum Weeks" ON public.curriculum_weeks FOR SELECT USING (true);
CREATE POLICY "Public Read Artworks" ON public.artworks FOR SELECT USING (true);
CREATE POLICY "Public Read Comments" ON public.comments FOR SELECT USING (true);

-- 4.2 老师写权限 (仅已登录认证用户 auth.uid() IS NOT NULL 可增删改作品、学员与周次)
CREATE POLICY "Teacher Manage Students" ON public.students
    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Teacher Manage Weeks" ON public.curriculum_weeks
    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Teacher Insert Artworks" ON public.artworks
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Teacher Update Artworks" ON public.artworks
    FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Teacher Delete Artworks" ON public.artworks
    FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- 4.3 家长/老师互动评论权限 (允许匿名用户或登录用户发表评论，但仅老师可删除评论)
CREATE POLICY "Anyone Can Insert Comments" ON public.comments
    FOR INSERT TO anon, authenticated
    WITH CHECK (
        char_length(trim(author_name)) > 0
        AND char_length(trim(content)) > 0
        AND (
            (author_role = 'parent') OR 
            (author_role = 'teacher' AND auth.uid() IS NOT NULL)
        )
    );

CREATE POLICY "Teacher Delete Comments" ON public.comments
    FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- 4.4 Storage 存储桶安全策略
CREATE POLICY "Public View Artwork Files" ON storage.objects
    FOR SELECT USING (bucket_id = 'artworks-storage');

CREATE POLICY "Teacher Upload Artwork Files" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'artworks-storage' AND auth.uid() IS NOT NULL);

CREATE POLICY "Teacher Update Delete Artwork Files" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'artworks-storage' AND auth.uid() IS NOT NULL);

-- ==========================================
-- 5. 初始演示种子数据 (方便开箱预览)
-- ==========================================
INSERT INTO public.students (id, name, avatar_url, passcode, remaining_hours) VALUES
    ('11111111-1111-1111-1111-111111111111', '奔奔', 'https://api.dicebear.com/7.x/adventurer/svg?seed=Ben', 'BEN2026', 16.5),
    ('22222222-2222-2222-2222-222222222222', '朵朵', 'https://api.dicebear.com/7.x/adventurer/svg?seed=Duo', 'DUO2026', 12.0),
    ('33333333-3333-3333-3333-333333333333', '小满', 'https://api.dicebear.com/7.x/adventurer/svg?seed=Man', 'MAN2026', 24.0)
ON CONFLICT (passcode) DO NOTHING;

INSERT INTO public.curriculum_weeks (id, week_code, title, theme_desc, start_date) VALUES
    ('aaaa1111-1111-1111-1111-111111111111', '2026-W44', '向日葵与梵高星空', '学习厚涂肌理与冷暖互补色对比，感受生命力与旋转笔触', '2026-10-26'),
    ('bbbb2222-2222-2222-2222-222222222222', '2026-W43', '秋日森林水彩写生', '掌握水彩湿画法晕染与落叶暖色系叠色技巧', '2026-10-19')
ON CONFLICT (week_code) DO NOTHING;

INSERT INTO public.artworks (id, student_id, week_id, title, image_url, stage, teacher_comment, tags) VALUES
    (
        'dddd1111-1111-1111-1111-111111111111',
        '11111111-1111-1111-1111-111111111111',
        'aaaa1111-1111-1111-1111-111111111111',
        '发光的夜晚向日葵',
        'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1000&q=80',
        '最终成作',
        '奔奔今天大胆使用了群青与柠檬黄的强烈对比，花瓣边缘的旋转笔触非常有力量感！',
        ARRAY['色彩对比', '笔触大胆', '天马行空']
    ),
    (
        'dddd2222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111',
        'aaaa1111-1111-1111-1111-111111111111',
        '向日葵线稿与构图探索',
        'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1000&q=80',
        '草图构思',
        '起形阶段抓住了花盘朝向的不同动态，构图饱满。',
        ARRAY['构图饱满', '观察细致']
    ),
    (
        'dddd3333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222',
        'aaaa1111-1111-1111-1111-111111111111',
        '星空下的猫咪花田',
        'https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=1000&q=80',
        '最终成作',
        '朵朵在星空主题里融入了自己最喜欢的小黑猫，紫罗兰渐变过渡得非常细腻温柔。',
        ARRAY['色彩细腻', '故事感强']
    )
ON CONFLICT (id) DO NOTHING;
