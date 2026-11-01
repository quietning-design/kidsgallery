import React, { useEffect, useState, useMemo } from 'react';
import {
  Clock,
  LayoutGrid,
  MessageCircle,
  Camera,
  KeyRound,
  LogOut,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import {
  supabase,
  isSupabaseConfigured,
  Student,
  CurriculumWeek,
  Artwork,
  DEMO_STUDENTS,
  DEMO_WEEKS,
  DEMO_ARTWORKS,
} from './lib/supabase';
import { PasscodeModal } from './components/PasscodeModal';
import { TeacherUploadModal } from './components/TeacherUploadModal';
import { CommentDrawer } from './components/CommentDrawer';
import { ArtworkLightbox } from './components/ArtworkLightbox';

export default function App() {
  const [activeTab, setActiveTab] = useState<'timeline' | 'weekly'>('timeline');
  const [students, setStudents] = useState<Student[]>(DEMO_STUDENTS);
  const [weeks, setWeeks] = useState<CurriculumWeek[]>(DEMO_WEEKS);
  const [artworks, setArtworks] = useState<Artwork[]>(DEMO_ARTWORKS);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(DEMO_STUDENTS[0]);

  // 弹窗控制状态
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showTeacherLogin, setShowTeacherLogin] = useState(
    () =>
      window.location.pathname.endsWith('/teacher/login') ||
      window.location.hash === '#/teacher/login'
  );
  const [activeCommentArtwork, setActiveCommentArtwork] = useState<Artwork | null>(null);
  const [lightboxArtwork, setLightboxArtwork] = useState<Artwork | null>(null);

  // 老师登录状态
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [isTeacherAuthenticated, setIsTeacherAuthenticated] = useState(false);

  // 加载核心数据
  const loadGalleryData = async () => {
    if (!isSupabaseConfigured) {
      const savedPasscode = localStorage.getItem('gallery_passcode');
      if (savedPasscode) {
        const matched = DEMO_STUDENTS.find(
          (s) => s.passcode.toUpperCase() === savedPasscode.toUpperCase()
        );
        if (matched) setCurrentStudent(matched);
      } else {
        setShowPasscodeModal(true);
      }
      return;
    }

    const [{ data: stuData }, { data: weekData }, { data: artData }] = await Promise.all([
      supabase.from('students').select('*').order('created_at', { ascending: true }),
      supabase.from('curriculum_weeks').select('*').order('start_date', { ascending: false }),
      supabase
        .from('artworks')
        .select('*, students(id, name, avatar_url), curriculum_weeks(id, week_code, title, theme_desc)')
        .order('created_at', { ascending: false }),
    ]);

    if (stuData && stuData.length > 0) {
      setStudents(stuData);
      const savedPasscode = localStorage.getItem('gallery_passcode');
      if (savedPasscode) {
        const matched = stuData.find(
          (s) => s.passcode.toUpperCase() === savedPasscode.toUpperCase()
        );
        if (matched) setCurrentStudent(matched);
      } else {
        setCurrentStudent(stuData[0]);
        setShowPasscodeModal(true);
      }
    }
    if (weekData && weekData.length > 0) setWeeks(weekData);
    if (artData && artData.length > 0) setArtworks(artData as Artwork[]);
  };

  useEffect(() => {
    loadGalleryData();

    if (!isSupabaseConfigured) return;

    // 监听 Supabase Auth 老师认证状态
    supabase.auth.getSession().then(({ data }) => {
      setIsTeacherAuthenticated(!!data.session);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsTeacherAuthenticated(!!session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 当前选中孩子的作品列表（按时间倒序）
  const studentArtworks = useMemo(() => {
    if (!currentStudent) return artworks;
    return artworks.filter((a) => a.student_id === currentStudent.id);
  }, [artworks, currentStudent]);

  // 灯箱中同一孩子同一周次的阶段演变作品
  const relatedStageArtworks = useMemo(() => {
    if (!lightboxArtwork) return [];
    return artworks
      .filter(
        (a) =>
          a.student_id === lightboxArtwork.student_id &&
          a.week_id === lightboxArtwork.week_id
      )
      .reverse();
  }, [artworks, lightboxArtwork]);

  // 老师登录提交
  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setIsTeacherAuthenticated(true);
      setShowTeacherLogin(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: teacherEmail,
      password: teacherPassword,
    });
    if (error) {
      alert('登录失败：' + error.message);
    } else {
      setShowTeacherLogin(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-stone-800 pb-24 max-w-md mx-auto shadow-xl relative">
      {/* 顶部品牌导航栏 */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#FAF7F2]/90 px-4 py-3.5 backdrop-blur-md border-b border-stone-200/60">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white font-bold shadow-sm">
            画
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-stone-900">
              光影少儿美育画廊
            </h1>
            <p className="text-[10px] text-stone-400">记录每一笔天马行空的成长</p>
          </div>
        </div>

        <button
          onClick={() => setShowPasscodeModal(true)}
          className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 active:scale-95"
        >
          <KeyRound className="h-3.5 w-3.5 text-amber-600" />
          <span>{currentStudent ? `${currentStudent.name}的暗号` : '输入家庭暗号'}</span>
        </button>
      </header>

      {/* 双轴切换 Segmented Tab */}
      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 rounded-2xl bg-stone-200/70 p-1">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
              activeTab === 'timeline'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500'
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            <span>个人时光机</span>
          </button>
          <button
            onClick={() => setActiveTab('weekly')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
              activeTab === 'weekly'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5 text-amber-500" />
            <span>每周大展厅</span>
          </button>
        </div>
      </div>

      {/* ==================== Tab 1: 个人时光机 ==================== */}
      {activeTab === 'timeline' && (
        <main className="px-4 pt-4 space-y-4">
          {/* 孩子切换栏 */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {students.map((stu) => (
              <button
                key={stu.id}
                onClick={() => setCurrentStudent(stu)}
                className={`flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition ${
                  currentStudent?.id === stu.id
                    ? 'border-stone-800 bg-stone-800 text-white'
                    : 'border-stone-200 bg-white text-stone-600'
                }`}
              >
                <img src={stu.avatar_url} alt={stu.name} className="h-4 w-4 rounded-full" />
                <span>{stu.name}</span>
              </button>
            ))}
          </div>

          {/* 孩子成长档案头部卡片 */}
          {currentStudent && (
            <div className="rounded-3xl bg-gradient-to-br from-amber-500 to-orange-400 p-5 text-white shadow-lg shadow-amber-500/15">
              <div className="flex items-center gap-3.5">
                <img
                  src={currentStudent.avatar_url}
                  alt={currentStudent.name}
                  className="h-14 w-14 rounded-2xl bg-white/20 p-1 backdrop-blur-sm"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">{currentStudent.name}的成长画册</h2>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">
                      小小艺术家
                    </span>
                  </div>
                  <p className="text-xs text-amber-50 mt-0.5">
                    专属暗号：{currentStudent.passcode}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-black/10 p-3 text-center backdrop-blur-sm">
                <div>
                  <p className="text-lg font-extrabold">{studentArtworks.length}</p>
                  <p className="text-[10px] text-amber-100">累计作品(幅)</p>
                </div>
                <div className="border-x border-white/15">
                  <p className="text-lg font-extrabold">{weeks.length}</p>
                  <p className="text-[10px] text-amber-100">点亮主题(周)</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold">{currentStudent.remaining_hours}</p>
                  <p className="text-[10px] text-amber-100">剩余课时(节)</p>
                </div>
              </div>
            </div>
          )}

          {/* 时间轴作品卡片流 */}
          <div className="relative space-y-5 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-amber-200">
            {studentArtworks.map((art) => (
              <div key={art.id} className="relative pl-8">
                {/* 时间轴圆点 */}
                <div className="absolute left-1.5 top-4 h-3.5 w-3.5 rounded-full border-2 border-amber-500 bg-[#FAF7F2]" />

                <article className="overflow-hidden rounded-3xl bg-white shadow-sm border border-stone-100">
                  {/* 画作大图（点击进入手势缩放灯箱） */}
                  <div
                    onClick={() => setLightboxArtwork(art)}
                    className="relative cursor-pointer overflow-hidden bg-stone-100"
                  >
                    <img
                      src={art.image_url}
                      alt={art.title}
                      loading="lazy"
                      className="max-h-80 w-full object-cover transition duration-300 active:scale-105"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-amber-300 backdrop-blur-sm">
                      {art.stage}
                    </span>
                  </div>

                  {/* 作品详情与老师点评 */}
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-stone-800">《{art.title}》</h3>
                        <p className="text-[11px] text-stone-400">
                          {art.curriculum_weeks?.week_code} · {art.curriculum_weeks?.title}
                        </p>
                      </div>
                      <span className="text-[10px] text-stone-400 shrink-0">
                        {new Date(art.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* 能力标签 */}
                    {art.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {art.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-medium text-amber-700"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 老师评语框 */}
                    {art.teacher_comment && (
                      <div className="rounded-2xl bg-stone-50 p-3 text-xs text-stone-600 leading-relaxed border border-stone-100">
                        <span className="font-bold text-stone-800">老师点评：</span>
                        {art.teacher_comment}
                      </div>
                    )}

                    {/* 底部操作栏：唤起互动评论抽屉 */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => setLightboxArtwork(art)}
                        className="text-[11px] font-medium text-amber-600"
                      >
                        查看高清原图与演变 →
                      </button>
                      <button
                        onClick={() => setActiveCommentArtwork(art)}
                        className="flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700 active:scale-95"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-amber-500" />
                        <span>写鼓励 / 评论</span>
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* ==================== Tab 2: 每周大展厅 ==================== */}
      {activeTab === 'weekly' && (
        <main className="px-4 pt-4 space-y-6">
          {weeks.map((week) => {
            const weekActs = artworks.filter((a) => a.week_id === week.id);
            return (
              <section
                key={week.id}
                className="rounded-3xl bg-white p-4 shadow-sm border border-stone-100 space-y-3"
              >
                <div className="border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-1.5 text-amber-600 text-xs font-bold">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{week.week_code} 主题展</span>
                  </div>
                  <h2 className="text-base font-bold text-stone-800 mt-0.5">{week.title}</h2>
                  <p className="text-xs text-stone-500 mt-1">{week.theme_desc}</p>
                </div>

                {/* 双列网格展示全班同题创作集 */}
                <div className="grid grid-cols-2 gap-3">
                  {weekActs.map((art) => (
                    <div
                      key={art.id}
                      className="group overflow-hidden rounded-2xl border border-stone-100 bg-stone-50/60 flex flex-col justify-between"
                    >
                      <div
                        onClick={() => setLightboxArtwork(art)}
                        className="relative aspect-square overflow-hidden bg-stone-200 cursor-pointer"
                      >
                        <img
                          src={art.image_url}
                          alt={art.title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] text-white">
                          {art.stage}
                        </span>
                      </div>

                      <div className="p-2.5 space-y-1.5">
                        <p className="truncate text-xs font-bold text-stone-800">
                          {art.title}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <img
                              src={art.students?.avatar_url}
                              alt={art.students?.name}
                              className="h-4 w-4 rounded-full bg-white"
                            />
                            <span className="text-[11px] text-stone-600">
                              {art.students?.name}
                            </span>
                          </div>
                          <button
                            onClick={() => setActiveCommentArtwork(art)}
                            className="rounded-full p-1 text-stone-400 hover:text-amber-600"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </main>
      )}

      {/* 底部隐蔽式老师通道入口 */}
      <footer className="mt-12 py-6 text-center text-[11px] text-stone-400">
        {isTeacherAuthenticated ? (
          <div className="inline-flex items-center gap-3 rounded-full bg-emerald-50 px-4 py-1.5 text-emerald-700 border border-emerald-200">
            <span className="flex items-center gap-1 font-medium">
              <ShieldCheck className="h-3.5 w-3.5" /> 老师管理模式已激活
            </span>
            <button
              onClick={() => {
                if (isSupabaseConfigured) supabase.auth.signOut();
                setIsTeacherAuthenticated(false);
              }}
              className="flex items-center gap-1 text-rose-600 underline"
            >
              <LogOut className="h-3 w-3" /> 退出
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowTeacherLogin(true)}
            className="opacity-50 hover:opacity-100 transition"
          >
            © 2026 少儿美育成长空间 · 老师教学工作台入口
          </button>
        )}
      </footer>

      {/* 老师已登录时：悬浮“随堂拍照上传” FAB 按钮 */}
      {isTeacherAuthenticated && (
        <button
          onClick={() => setShowUploadModal(true)}
          className="fixed bottom-6 right-5 z-40 flex items-center gap-2 rounded-full bg-stone-900 px-5 py-3.5 text-xs font-bold text-white shadow-xl shadow-stone-900/30 active:scale-95"
        >
          <Camera className="h-4 w-4 text-amber-400" />
          <span>随堂拍照点评</span>
        </button>
      )}

      {/* 老师登录弹窗 (支持底部触发或 /teacher/login 路径) */}
      {showTeacherLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-stone-800">老师工作台登录</h3>
            <form onSubmit={handleTeacherLogin} className="space-y-3">
              <input
                type="email"
                required
                value={teacherEmail}
                onChange={(e) => setTeacherEmail(e.target.value)}
                placeholder="老师邮箱账号"
                className="w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-xs"
              />
              <input
                type="password"
                required
                value={teacherPassword}
                onChange={(e) => setTeacherPassword(e.target.value)}
                placeholder="登录密码"
                className="w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-xs"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowTeacherLogin(false)}
                  className="flex-1 rounded-xl border border-stone-200 py-2.5 text-xs text-stone-600"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-stone-900 py-2.5 text-xs font-semibold text-white"
                >
                  登录激活上传
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 弹窗与抽屉挂载 */}
      <PasscodeModal
        isOpen={showPasscodeModal}
        students={students}
        onSelectStudent={(stu) => {
          setCurrentStudent(stu);
          setActiveTab('timeline');
          setShowPasscodeModal(false);
        }}
        onDismissAsGuest={() => setShowPasscodeModal(false)}
      />

      <TeacherUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        students={students}
        weeks={weeks}
        onUploadSuccess={loadGalleryData}
      />

      <CommentDrawer
        artwork={activeCommentArtwork}
        isTeacher={isTeacherAuthenticated}
        onClose={() => setActiveCommentArtwork(null)}
      />

      <ArtworkLightbox
        artwork={lightboxArtwork}
        relatedStages={relatedStageArtworks}
        onSelectArtwork={(art) => setLightboxArtwork(art)}
        onClose={() => setLightboxArtwork(null)}
      />
    </div>
  );
}
