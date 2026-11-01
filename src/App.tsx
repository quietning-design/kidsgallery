import React, { useEffect, useState, useMemo } from 'react';
import {
  Clock,
  LayoutGrid,
  MessageCircle,
  Camera,
  LogOut,
  ShieldCheck,
  Calendar,
  Settings,
  Pin,
  Sparkles,
  UserCheck,
  Edit2,
} from 'lucide-react';
import {
  supabase,
  isSupabaseConfigured,
  Student,
  CurriculumWeek,
  Artwork,
  CommentItem,
  DEMO_STUDENTS,
  DEMO_WEEKS,
  DEMO_ARTWORKS,
} from './lib/supabase';
import { TeacherUploadModal } from './components/TeacherUploadModal';
import { CommentDrawer } from './components/CommentDrawer';
import { ArtworkLightbox } from './components/ArtworkLightbox';
import { AdminDashboardModal } from './components/AdminDashboardModal';

const STORAGE_NAME_KEY = 'gallery_parent_nickname';
const STORAGE_STUDENT_ID_KEY = 'gallery_selected_student_id';

export default function App() {
  const [activeTab, setActiveTab] = useState<'timeline' | 'weekly'>('timeline');
  const [students, setStudents] = useState<Student[]>(DEMO_STUDENTS);
  const [weeks, setWeeks] = useState<CurriculumWeek[]>(DEMO_WEEKS);
  const [artworks, setArtworks] = useState<Artwork[]>(DEMO_ARTWORKS);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(DEMO_STUDENTS[0]);

  // 记住的评论人昵称状态（顶部展示与修改）
  const [savedNickname, setSavedNickname] = useState(
    () => localStorage.getItem(STORAGE_NAME_KEY) || ''
  );

  // 弹窗控制状态（仅保留老师后台与拍照上传、评论抽屉、高清灯箱，全员免密直接访问）
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [pendingOpenAdmin, setPendingOpenAdmin] = useState(false);
  const [showTeacherLogin, setShowTeacherLogin] = useState(() => {
    const p = window.location.pathname;
    const h = window.location.hash;
    return (
      p.endsWith('/teacher/login') ||
      p.endsWith('/admin') ||
      h === '#/teacher/login' ||
      h === '#/admin'
    );
  });
  const [activeCommentArtwork, setActiveCommentArtwork] = useState<Artwork | null>(null);
  const [lightboxArtwork, setLightboxArtwork] = useState<Artwork | null>(null);

  // 老师登录状态
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [isTeacherAuthenticated, setIsTeacherAuthenticated] = useState(false);

  // 加载核心数据（全员免密直接读取）
  const loadGalleryData = async () => {
    setSavedNickname(localStorage.getItem(STORAGE_NAME_KEY) || '');

    if (!isSupabaseConfigured) {
      const lastStuId = localStorage.getItem(STORAGE_STUDENT_ID_KEY);
      if (lastStuId) {
        const matched = DEMO_STUDENTS.find((s) => s.id === lastStuId);
        if (matched) setCurrentStudent(matched);
      }
      return;
    }

    const [{ data: stuData }, { data: weekData }, { data: artData }] = await Promise.all([
      supabase.from('students').select('*').order('created_at', { ascending: true }),
      supabase.from('curriculum_weeks').select('*').order('start_date', { ascending: false }),
      supabase
        .from('artworks')
        .select(
          '*, students(id, name, avatar_url), curriculum_weeks(id, week_code, title, theme_desc), comments(id, artwork_id, author_name, author_role, content, created_at)'
        )
        .order('created_at', { ascending: false }),
    ]);

    if (stuData && stuData.length > 0) {
      setStudents(stuData);
      const lastStuId = localStorage.getItem(STORAGE_STUDENT_ID_KEY);
      const matched = lastStuId ? stuData.find((s) => s.id === lastStuId) : null;
      setCurrentStudent((prev) => matched || prev || stuData[0]);
    }
    if (weekData && weekData.length > 0) setWeeks(weekData);
    if (artData) setArtworks(artData as Artwork[]);
  };

  useEffect(() => {
    loadGalleryData();

    const isEnteringAdminRoute =
      window.location.pathname.endsWith('/admin') || window.location.hash === '#/admin';
    if (isEnteringAdminRoute) {
      setPendingOpenAdmin(true);
    }

    if (!isSupabaseConfigured) return;

    // 监听 Supabase Auth 老师认证状态
    supabase.auth.getSession().then(({ data }) => {
      const authed = !!data.session;
      setIsTeacherAuthenticated(authed);
      if (authed && isEnteringAdminRoute) {
        setShowTeacherLogin(false);
        setShowAdminDashboard(true);
      }
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsTeacherAuthenticated(!!session);
    });

    // 全局实时监听新评论或删除评论，让个人时光机卡片下方的评论流实时更新
    const commentsChannel = supabase
      .channel('timeline-comments-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        () => {
          loadGalleryData();
        }
      )
      .subscribe();

    return () => {
      authListener.subscription.unsubscribe();
      supabase.removeChannel(commentsChannel);
    };
  }, []);

  // 选择查看的孩子（自动记忆上次浏览的孩子）
  const handleSelectStudent = (stu: Student) => {
    setCurrentStudent(stu);
    localStorage.setItem(STORAGE_STUDENT_ID_KEY, stu.id);
  };

  // 修改已记住的评论人昵称
  const handleQuickEditNickname = () => {
    const next = window.prompt('请输入您的评论称呼（如：奔奔妈妈）：', savedNickname);
    if (next && next.trim()) {
      localStorage.setItem(STORAGE_NAME_KEY, next.trim());
      setSavedNickname(next.trim());
    }
  };

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
      if (pendingOpenAdmin) {
        setShowAdminDashboard(true);
        setPendingOpenAdmin(false);
      }
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
      if (pendingOpenAdmin) {
        setShowAdminDashboard(true);
        setPendingOpenAdmin(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-stone-800 pb-24 max-w-md mx-auto shadow-xl relative">
      {/* 顶部品牌导航栏（无需任何登录密码，直接显示已记住的评论人身份） */}
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

        {savedNickname ? (
          <button
            onClick={handleQuickEditNickname}
            className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-medium text-emerald-800 active:scale-95"
          >
            <UserCheck className="h-3 w-3 text-emerald-600" />
            <span>{savedNickname}</span>
            <Edit2 className="h-2.5 w-2.5 text-emerald-500 ml-0.5" />
          </button>
        ) : (
          <button
            onClick={handleQuickEditNickname}
            className="flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 active:scale-95"
          >
            <Edit2 className="h-3 w-3 text-amber-500" />
            <span>设置评论称呼</span>
          </button>
        )}
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
          {/* 孩子切换栏（免密直接点击任意孩子查看） */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {students.map((stu) => (
              <button
                key={stu.id}
                onClick={() => handleSelectStudent(stu)}
                className={`flex items-center gap-1.5 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium border transition ${
                  currentStudent?.id === stu.id
                    ? 'border-stone-800 bg-stone-800 text-white shadow-sm'
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
                    每一次落笔，都是闪闪发光的童年印记
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
                {isTeacherAuthenticated ? (
                  <div>
                    <p className="text-lg font-extrabold">{currentStudent.remaining_hours}</p>
                    <p className="text-[10px] text-amber-100">剩余课时(老师可见)</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-extrabold">
                      {studentArtworks.reduce((sum, a) => sum + (a.comments?.length || 0), 0)}
                    </p>
                    <p className="text-[10px] text-amber-100">收获鼓励(条)</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 时间轴作品卡片流 */}
          <div className="relative space-y-5 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-amber-200">
            {studentArtworks.map((art) => {
              // 拆分并排序评论：老师追加点评置顶在前，家长/匿名访客评论按时间排列在后
              const rawComments: CommentItem[] = art.comments || [];
              const teacherExtraComments = rawComments
                .filter((c) => c.author_role === 'teacher')
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              const parentAndGuestComments = rawComments
                .filter((c) => c.author_role !== 'teacher')
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

              return (
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

                    {/* 作品详情、置顶老师点评与直接展开的家长评论区 */}
                    <div className="p-4 space-y-3">
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

                      {/* ===== 点评与互动评论流（老师置顶 + 家长/访客评论紧随其后直接展示） ===== */}
                      <div className="space-y-2 pt-1">
                        {/* 1. 置顶：老师主点评 */}
                        {art.teacher_comment && (
                          <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-amber-50/70 to-orange-50/40 p-3 text-xs leading-relaxed border border-amber-200/80 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                                  <Pin className="h-2.5 w-2.5 rotate-45" />
                                  置顶 · 老师专业点评
                                </span>
                              </div>
                              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                            </div>
                            <p className="text-stone-800 font-medium mt-1">
                              {art.teacher_comment}
                            </p>
                          </div>
                        )}

                        {/* 2. 置顶：老师在评论区追加的点评 */}
                        {teacherExtraComments.map((tc) => (
                          <div
                            key={tc.id}
                            className="rounded-2xl bg-amber-50/60 p-2.5 text-xs leading-relaxed border border-amber-200/60"
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[9px] font-bold text-white">
                                  置顶 · {tc.author_name}
                                </span>
                              </div>
                              <span className="text-[10px] text-stone-400">
                                {new Date(tc.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-stone-700 mt-1">{tc.content}</p>
                          </div>
                        ))}

                        {/* 3. 跟在下方直接展示：父母、亲友或匿名访客的点评与鼓励 */}
                        {parentAndGuestComments.length > 0 && (
                          <div className="rounded-2xl bg-stone-50/90 p-3 space-y-2 border border-stone-100">
                            {parentAndGuestComments.map((c) => (
                              <div
                                key={c.id}
                                className="text-xs leading-relaxed border-b border-stone-200/50 last:border-none pb-2 last:pb-0"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-stone-700">
                                    {c.author_name}：
                                  </span>
                                  <span className="text-[10px] text-stone-400">
                                    {new Date(c.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-stone-600 mt-0.5">{c.content}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 底部操作栏：高清原图与写评论按钮 */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() => setLightboxArtwork(art)}
                          className="text-[11px] font-medium text-amber-600"
                        >
                          查看高清原图与演变 →
                        </button>
                        <button
                          onClick={() => setActiveCommentArtwork(art)}
                          className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/80 px-3 py-1.5 text-xs font-semibold text-amber-800 active:scale-95"
                        >
                          <MessageCircle className="h-3.5 w-3.5 text-amber-600" />
                          <span>
                            写鼓励 / 评论
                            {rawComments.length > 0 ? ` (${rawComments.length})` : ''}
                          </span>
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
              );
            })}
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
                            className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] text-stone-400 hover:text-amber-600"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            {(art.comments?.length || 0) > 0 && (
                              <span>{art.comments?.length}</span>
                            )}
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

      {/* 底部老师后台管理与工作台入口（唯一保留的登录入口） */}
      <footer className="mt-12 py-6 text-center text-[11px] text-stone-400">
        {isTeacherAuthenticated ? (
          <div className="inline-flex items-center gap-3 rounded-full bg-emerald-50 px-4 py-1.5 text-emerald-700 border border-emerald-200">
            <span className="flex items-center gap-1 font-medium">
              <ShieldCheck className="h-3.5 w-3.5" /> 老师管理模式已激活
            </span>
            <button
              onClick={() => setShowAdminDashboard(true)}
              className="font-bold text-amber-700 underline"
            >
              进入后台管理
            </button>
            <button
              onClick={() => {
                if (isSupabaseConfigured) supabase.auth.signOut();
                setIsTeacherAuthenticated(false);
                setShowAdminDashboard(false);
              }}
              className="flex items-center gap-1 text-rose-600 underline"
            >
              <LogOut className="h-3 w-3" /> 退出
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setPendingOpenAdmin(true);
                setShowTeacherLogin(true);
              }}
              className="opacity-60 hover:opacity-100 transition underline"
            >
              © 2026 少儿美育成长空间 · 老师后台管理入口
            </button>
          </div>
        )}
      </footer>

      {/* 老师已登录时：悬浮双按钮（后台管理中心 + 随堂拍照点评） */}
      {isTeacherAuthenticated && (
        <div className="fixed bottom-6 right-4 z-40 flex items-center gap-2">
          <button
            onClick={() => setShowAdminDashboard(true)}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-3.5 text-xs font-bold text-stone-800 shadow-xl border border-stone-200 active:scale-95"
          >
            <Settings className="h-4 w-4 text-amber-500" />
            <span>后台管理</span>
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-3.5 text-xs font-bold text-white shadow-xl shadow-stone-900/30 active:scale-95"
          >
            <Camera className="h-4 w-4 text-amber-400" />
            <span>随堂拍照点评</span>
          </button>
        </div>
      )}

      {/* 老师登录弹窗 (支持底部触发或 /admin、/teacher/login 路径) */}
      {showTeacherLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-stone-800">老师后台管理登录</h3>
              <p className="text-[11px] text-stone-400 mt-0.5">
                请使用在 Supabase Authentication 中创建的老师账号登录
              </p>
            </div>
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
                  onClick={() => {
                    setShowTeacherLogin(false);
                    setPendingOpenAdmin(false);
                  }}
                  className="flex-1 rounded-xl border border-stone-200 py-2.5 text-xs text-stone-600"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-stone-900 py-2.5 text-xs font-semibold text-white"
                >
                  登录进入后台
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 弹窗与抽屉挂载 */}
      <TeacherUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        students={students}
        weeks={weeks}
        onUploadSuccess={loadGalleryData}
      />

      <AdminDashboardModal
        isOpen={showAdminDashboard}
        onClose={() => setShowAdminDashboard(false)}
        students={students}
        weeks={weeks}
        artworks={artworks}
        onDataChanged={loadGalleryData}
        onOpenUploadModal={() => setShowUploadModal(true)}
      />

      <CommentDrawer
        artwork={activeCommentArtwork}
        isTeacher={isTeacherAuthenticated}
        onClose={() => {
          setActiveCommentArtwork(null);
          loadGalleryData();
        }}
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
