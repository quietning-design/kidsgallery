import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://bmpryfkpognmjijesaex.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_MM7nQi8qz9mVCOH-LQsCuA_3_mK9bod';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !String(supabaseUrl).includes('your-project-ref');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type StageType = '草图构思' | '色彩打底' | '最终成作';

export const PRESET_CATEGORIES = ['原创', '水彩', '素描', '儿童画', '油画棒', '综合材料'];

export interface Student {
  id: string;
  name: string;
  avatar_url: string;
  passcode: string;
  remaining_hours: number;
  created_at: string;
}

export interface CurriculumWeek {
  id: string;
  week_code: string;
  title: string;
  theme_desc: string;
  start_date: string;
}

export interface CommentItem {
  id: string;
  artwork_id: string;
  author_name: string;
  author_role: 'teacher' | 'parent';
  content: string;
  created_at: string;
  isOptimistic?: boolean;
}

export interface Artwork {
  id: string;
  student_id: string;
  week_id: string;
  title: string;
  image_url: string;
  stage: StageType;
  teacher_comment: string;
  audio_comment_url?: string | null;
  tags: string[];
  created_at: string;
  students?: Pick<Student, 'id' | 'name' | 'avatar_url'>;
  curriculum_weeks?: Pick<CurriculumWeek, 'id' | 'week_code' | 'title' | 'theme_desc'>;
  comments?: CommentItem[];
}

/**
 * 从作品 tags 中提取作品分类（如 'cat:水彩' -> '水彩'），默认返回 '儿童画'
 */
export function getArtworkCategory(art: Pick<Artwork, 'tags'>): string {
  const found = (art.tags || []).find((t) => t.startsWith('cat:'));
  return found ? found.slice(4) : '儿童画';
}

/**
 * 判断作品是否被挑入首页「光影画廊」精选
 */
export function isArtworkFeatured(art: Pick<Artwork, 'tags'>): boolean {
  return (art.tags || []).includes('featured:true');
}

/**
 * 提取普通能力标签（过滤掉内部元数据前缀 cat: 与 featured:）
 */
export function getVisibleSkillTags(art: Pick<Artwork, 'tags'>): string[] {
  return (art.tags || []).filter(
    (t) => !t.startsWith('cat:') && !t.startsWith('featured:')
  );
}

/**
 * 组装保存至数据库的 tags 数组（包含能力标签 + 作品分类 + 首页精选标记）
 */
export function buildTagsWithMeta(
  skillTags: string[],
  category: string,
  isFeatured: boolean
): string[] {
  const cleanSkills = skillTags.filter(
    (t) => !t.startsWith('cat:') && !t.startsWith('featured:')
  );
  const cleanCategory = (category || '儿童画').trim();
  const result = [...cleanSkills, `cat:${cleanCategory}`];
  if (isFeatured) {
    result.push('featured:true');
  }
  return result;
}

// 本地演示数据
export const DEMO_STUDENTS: Student[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: '奔奔',
    avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Ben',
    passcode: 'BEN2026',
    remaining_hours: 16.5,
    created_at: '2026-09-01T10:00:00Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: '朵朵',
    avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Duo',
    passcode: 'DUO2026',
    remaining_hours: 12.0,
    created_at: '2026-09-01T10:00:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: '小满',
    avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Man',
    passcode: 'MAN2026',
    remaining_hours: 24.0,
    created_at: '2026-09-01T10:00:00Z',
  },
];

export const DEMO_WEEKS: CurriculumWeek[] = [
  {
    id: 'aaaa1111-1111-1111-1111-111111111111',
    week_code: '2026-W44',
    title: '向日葵与梵高星空',
    theme_desc: '学习厚涂肌理与冷暖互补色对比，感受生命力与旋转笔触',
    start_date: '2026-10-26',
  },
  {
    id: 'bbbb2222-2222-2222-2222-222222222222',
    week_code: '2026-W43',
    title: '秋日森林水彩写生',
    theme_desc: '掌握水彩湿画法晕染与落叶暖色系叠色技巧',
    start_date: '2026-10-19',
  },
];

export const DEMO_ARTWORKS: Artwork[] = [
  {
    id: 'dddd1111-1111-1111-1111-111111111111',
    student_id: '11111111-1111-1111-1111-111111111111',
    week_id: 'aaaa1111-1111-1111-1111-111111111111',
    title: '发光的夜晚向日葵',
    image_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1000&q=80',
    stage: '最终成作',
    teacher_comment: '奔奔今天大胆使用了群青与柠檬黄的强烈对比，花瓣边缘的旋转笔触非常有力量感！',
    tags: ['色彩对比', '笔触大胆', '天马行空', 'cat:水彩', 'featured:true'],
    created_at: '2026-10-28T15:30:00Z',
    students: {
      id: '11111111-1111-1111-1111-111111111111',
      name: '奔奔',
      avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Ben',
    },
    curriculum_weeks: {
      id: 'aaaa1111-1111-1111-1111-111111111111',
      week_code: '2026-W44',
      title: '向日葵与梵高星空',
      theme_desc: '学习厚涂肌理与冷暖互补色对比，感受生命力与旋转笔触',
    },
    comments: [
      {
        id: 'c-demo-1',
        artwork_id: 'dddd1111-1111-1111-1111-111111111111',
        author_name: '奔奔妈妈',
        author_role: 'parent',
        content: '宝贝画的向日葵太有活力啦，挂在客厅超好看！🌻',
        created_at: '2026-10-28T18:10:00Z',
      },
      {
        id: 'c-demo-2',
        artwork_id: 'dddd1111-1111-1111-1111-111111111111',
        author_name: '朵朵外婆',
        author_role: 'parent',
        content: '颜色真鲜亮，给小画家点赞👍',
        created_at: '2026-10-28T19:05:00Z',
      },
    ],
  },
  {
    id: 'dddd2222-2222-2222-2222-222222222222',
    student_id: '11111111-1111-1111-1111-111111111111',
    week_id: 'aaaa1111-1111-1111-1111-111111111111',
    title: '向日葵线稿与构图探索',
    image_url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1000&q=80',
    stage: '草图构思',
    teacher_comment: '起形阶段抓住了花盘朝向的不同动态，构图饱满。',
    tags: ['构图饱满', '观察细致', 'cat:素描'],
    created_at: '2026-10-28T14:20:00Z',
    students: {
      id: '11111111-1111-1111-1111-111111111111',
      name: '奔奔',
      avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Ben',
    },
    curriculum_weeks: {
      id: 'aaaa1111-1111-1111-1111-111111111111',
      week_code: '2026-W44',
      title: '向日葵与梵高星空',
      theme_desc: '学习厚涂肌理与冷暖互补色对比，感受生命力与旋转笔触',
    },
    comments: [],
  },
  {
    id: 'dddd3333-3333-3333-3333-333333333333',
    student_id: '22222222-2222-2222-2222-222222222222',
    week_id: 'aaaa1111-1111-1111-1111-111111111111',
    title: '星空下的猫咪花田',
    image_url: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=1000&q=80',
    stage: '最终成作',
    teacher_comment: '朵朵在星空主题里融入了自己最喜欢的小黑猫，紫罗兰渐变过渡得非常细腻温柔。',
    tags: ['色彩细腻', '故事感强', 'cat:原创', 'featured:true'],
    created_at: '2026-10-27T16:10:00Z',
    students: {
      id: '22222222-2222-2222-2222-222222222222',
      name: '朵朵',
      avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Duo',
    },
    curriculum_weeks: {
      id: 'aaaa1111-1111-1111-1111-111111111111',
      week_code: '2026-W44',
      title: '向日葵与梵高星空',
      theme_desc: '学习厚涂肌理与冷暖互补色对比，感受生命力与旋转笔触',
    },
    comments: [],
  },
];
