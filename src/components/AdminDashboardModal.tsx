import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Calendar,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Check,
  RefreshCw,
  BookOpen,
  Camera,
  Save,
  Star,
} from 'lucide-react';
import {
  supabase,
  isSupabaseConfigured,
  Student,
  CurriculumWeek,
  Artwork,
  CommentItem,
  StageType,
  PRESET_CATEGORIES,
  getArtworkCategory,
  isArtworkFeatured,
  getVisibleSkillTags,
  buildTagsWithMeta,
} from '../lib/supabase';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  weeks: CurriculumWeek[];
  artworks: Artwork[];
  onDataChanged: () => void;
  onOpenUploadModal: () => void;
}

const AVATAR_SEEDS = ['Felix', 'Aneka', 'Milo', 'Luna', 'Leo', 'Zoe', 'Coco', 'Max'];
const STAGES: StageType[] = ['草图构思', '色彩打底', '最终成作'];

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  students,
  weeks,
  artworks,
  onDataChanged,
  onOpenUploadModal,
}) => {
  const [activeSection, setActiveSection] = useState<'students' | 'weeks' | 'artworks' | 'comments'>('students');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 1. 新增/编辑学员表单状态
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [stuName, setStuName] = useState('');
  const [stuHours, setStuHours] = useState('16');
  const [stuAvatarSeed, setStuAvatarSeed] = useState('Felix');

  // 2. 新增/编辑教学周次表单状态
  const [editingWeekId, setEditingWeekId] = useState<string | null>(null);
  const [weekCode, setWeekCode] = useState('2026-W45');
  const [weekTitle, setWeekTitle] = useState('');
  const [weekDesc, setWeekDesc] = useState('');
  const [weekDate, setWeekDate] = useState(() => new Date().toISOString().slice(0, 10));

  // 3. 编辑作品状态
  const [editingArtwork, setEditingArtwork] = useState<Artwork | null>(null);
  const [artTitle, setArtTitle] = useState('');
  const [artStage, setArtStage] = useState<StageType>('最终成作');
  const [artCategory, setArtCategory] = useState('儿童画');
  const [artFeatured, setArtFeatured] = useState(false);
  const [artComment, setArtComment] = useState('');

  // 4. 评论管理列表
  const [allComments, setAllComments] = useState<(CommentItem & { artworks?: { title: string } })[]>([]);

  useEffect(() => {
    if (isOpen && activeSection === 'comments' && isSupabaseConfigured) {
      fetchAllComments();
    }
  }, [isOpen, activeSection]);

  const fetchAllComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*, artworks(title)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setAllComments(data as any);
  };

  if (!isOpen) return null;

  // 保存学员
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stuName.trim()) return alert('请填写学员姓名');
    setLoading(true);
    const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(stuAvatarSeed)}`;

    try {
      if (editingStudentId) {
        const { error } = await supabase
          .from('students')
          .update({
            name: stuName.trim(),
            remaining_hours: Number(stuHours) || 0,
            avatar_url: avatarUrl,
          })
          .eq('id', editingStudentId);
        if (error) throw error;
      } else {
        const autoCode = `STU${Date.now().toString().slice(-6)}`;
        const { error } = await supabase.from('students').insert({
          name: stuName.trim(),
          passcode: autoCode,
          remaining_hours: Number(stuHours) || 0,
          avatar_url: avatarUrl,
        });
        if (error) throw error;
      }

      setEditingStudentId(null);
      setStuName('');
      setStuHours('16');
      onDataChanged();
    } catch (err: any) {
      alert('保存学员失败：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 快捷增减课时
  const handleAdjustHours = async (stu: Student, delta: number) => {
    const nextHours = Math.max(0, Number((Number(stu.remaining_hours) + delta).toFixed(1)));
    const { error } = await supabase
      .from('students')
      .update({ remaining_hours: nextHours })
      .eq('id', stu.id);
    if (error) {
      alert('课时更新失败：' + error.message);
    } else {
      onDataChanged();
    }
  };

  // 删除学员
  const handleDeleteStudent = async (stu: Student) => {
    if (!window.confirm(`确定要删除学员【${stu.name}】及其名下关联作品吗？此操作不可恢复。`)) return;
    const { error } = await supabase.from('students').delete().eq('id', stu.id);
    if (error) alert('删除失败：' + error.message);
    else onDataChanged();
  };

  // 复制家长微信通知文案
  const handleCopyInvite = (stu: Student) => {
    const siteUrl = window.location.origin + window.location.pathname;
    const text = `🎨【光影少儿美育画廊】\n${stu.name}家长您好！孩子的课堂画作与老师点评已更新✨\n👉 点击直接查看（无需密码）：${siteUrl}\n欢迎在画作下方为孩子写下鼓励留言～`;
    navigator.clipboard.writeText(text);
    setCopiedId(stu.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 保存教学周次
  const handleSaveWeek = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weekCode.trim() || !weekTitle.trim()) return alert('请填写周次编号和课程主题');
    setLoading(true);
    try {
      if (editingWeekId) {
        const { error } = await supabase
          .from('curriculum_weeks')
          .update({
            week_code: weekCode.trim(),
            title: weekTitle.trim(),
            theme_desc: weekDesc.trim(),
            start_date: weekDate,
          })
          .eq('id', editingWeekId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('curriculum_weeks').insert({
          week_code: weekCode.trim(),
          title: weekTitle.trim(),
          theme_desc: weekDesc.trim(),
          start_date: weekDate,
        });
        if (error) throw error;
      }

      setEditingWeekId(null);
      setWeekTitle('');
      setWeekDesc('');
      onDataChanged();
    } catch (err: any) {
      alert('保存课程周次失败：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 删除教学周次
  const handleDeleteWeek = async (w: CurriculumWeek) => {
    if (!window.confirm(`确定删除课程周次【${w.week_code} ${w.title}】吗？`)) return;
    const { error } = await supabase.from('curriculum_weeks').delete().eq('id', w.id);
    if (error) alert('删除失败：' + error.message);
    else onDataChanged();
  };

  // 一键切换作品是否选入首页「光影画廊」
  const handleToggleFeatured = async (art: Artwork) => {
    const currentFeatured = isArtworkFeatured(art);
    const currentCat = getArtworkCategory(art);
    const skillTags = getVisibleSkillTags(art);
    const updatedTags = buildTagsWithMeta(skillTags, currentCat, !currentFeatured);

    const { error } = await supabase
      .from('artworks')
      .update({ tags: updatedTags })
      .eq('id', art.id);

    if (error) {
      alert('设置精选失败：' + error.message);
    } else {
      onDataChanged();
    }
  };

  // 更新作品点评、分类或阶段
  const handleUpdateArtwork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArtwork) return;
    setLoading(true);
    try {
      const skillTags = getVisibleSkillTags(editingArtwork);
      const updatedTags = buildTagsWithMeta(skillTags, artCategory, artFeatured);

      const { error } = await supabase
        .from('artworks')
        .update({
          title: artTitle.trim(),
          stage: artStage,
          teacher_comment: artComment.trim(),
          tags: updatedTags,
        })
        .eq('id', editingArtwork.id);
      if (error) throw error;
      setEditingArtwork(null);
      onDataChanged();
    } catch (err: any) {
      alert('更新作品失败：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 删除作品
  const handleDeleteArtwork = async (art: Artwork) => {
    if (!window.confirm(`确定要删除作品《${art.title}》吗？`)) return;
    const { error } = await supabase.from('artworks').delete().eq('id', art.id);
    if (error) alert('删除失败：' + error.message);
    else onDataChanged();
  };

  // 删除评论
  const handleDeleteComment = async (id: string) => {
    if (!window.confirm('确定删除这条评论吗？')) return;
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) alert('删除评论失败：' + error.message);
    else setAllComments((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#FAF7F2] text-stone-800 overflow-hidden">
      {/* 顶部后台导航栏 */}
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-amber-400 font-bold">
            管
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-900">画室教务与画廊后台管理中心</h2>
            <p className="text-[11px] text-stone-400">
              学员课时 · 教学周次 · 首页精选与分类 · 评论管理
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onClose();
              onOpenUploadModal();
            }}
            className="flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm active:scale-95"
          >
            <Camera className="h-3.5 w-3.5" />
            <span>发作品</span>
          </button>
          <button
            onClick={onClose}
            className="rounded-full bg-stone-100 p-2 text-stone-600 hover:bg-stone-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* 主体内容容器 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4 space-y-5 pb-24">
          {/* 顶部数据概览卡片 */}
          <div className="grid grid-cols-4 gap-2.5">
            <div className="rounded-2xl bg-white p-3 text-center border border-stone-100 shadow-sm">
              <p className="text-lg font-extrabold text-stone-900">{students.length}</p>
              <p className="text-[10px] text-stone-400">在读学员</p>
            </div>
            <div className="rounded-2xl bg-white p-3 text-center border border-stone-100 shadow-sm">
              <p className="text-lg font-extrabold text-amber-600">{weeks.length}</p>
              <p className="text-[10px] text-stone-400">课程周次</p>
            </div>
            <div className="rounded-2xl bg-white p-3 text-center border border-stone-100 shadow-sm">
              <p className="text-lg font-extrabold text-emerald-600">{artworks.length}</p>
              <p className="text-[10px] text-stone-400">展出画作</p>
            </div>
            <button
              onClick={onDataChanged}
              className="flex flex-col items-center justify-center rounded-2xl bg-stone-100 p-3 text-stone-600 active:scale-95"
            >
              <RefreshCw className="h-4 w-4 mb-1" />
              <span className="text-[10px] font-medium">刷新数据</span>
            </button>
          </div>

          {/* 四大管理模块切换栏 */}
          <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-stone-200/70 p-1">
            <button
              onClick={() => setActiveSection('students')}
              className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold transition ${
                activeSection === 'students' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>学员/课时</span>
            </button>
            <button
              onClick={() => setActiveSection('weeks')}
              className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold transition ${
                activeSection === 'weeks' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>教学周次</span>
            </button>
            <button
              onClick={() => setActiveSection('artworks')}
              className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold transition ${
                activeSection === 'artworks' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span>作品/精选</span>
            </button>
            <button
              onClick={() => setActiveSection('comments')}
              className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold transition ${
                activeSection === 'comments' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>评论管理</span>
            </button>
          </div>

          {/* ==================== 模块 1：学员与课时管理 ==================== */}
          {activeSection === 'students' && (
            <div className="space-y-4">
              <form
                onSubmit={handleSaveStudent}
                className="rounded-3xl bg-white p-4 shadow-sm border border-stone-100 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Plus className="h-4 w-4 text-amber-500" />
                    <span>{editingStudentId ? '编辑学员档案' : '新增学员档案'}</span>
                  </h3>
                  {editingStudentId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStudentId(null);
                        setStuName('');
                      }}
                      className="text-[11px] text-stone-400 underline"
                    >
                      取消编辑
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <input
                    type="text"
                    required
                    value={stuName}
                    onChange={(e) => setStuName(e.target.value)}
                    placeholder="学员姓名（如：奔奔）"
                    className="rounded-xl border border-stone-200 px-3 py-2 text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500 shrink-0">剩余课时:</span>
                    <input
                      type="number"
                      step="0.5"
                      value={stuHours}
                      onChange={(e) => setStuHours(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-stone-400 mb-1.5">选择趣味卡通头像：</label>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {AVATAR_SEEDS.map((seed) => {
                      const url = `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;
                      return (
                        <button
                          type="button"
                          key={seed}
                          onClick={() => setStuAvatarSeed(seed)}
                          className={`h-9 w-9 shrink-0 rounded-full p-0.5 border-2 transition ${
                            stuAvatarSeed === seed ? 'border-amber-500 bg-amber-50' : 'border-transparent bg-stone-100'
                          }`}
                        >
                          <img src={url} alt={seed} className="h-full w-full rounded-full" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-stone-900 py-2.5 text-xs font-bold text-white active:scale-[0.99]"
                >
                  {editingStudentId ? '保存学员修改' : '确认添加学员'}
                </button>
              </form>

              <div className="space-y-2.5">
                {students.map((stu) => (
                  <div
                    key={stu.id}
                    className="flex flex-col gap-3 rounded-2xl bg-white p-3.5 shadow-sm border border-stone-100 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={stu.avatar_url}
                        alt={stu.name}
                        className="h-11 w-11 rounded-2xl bg-amber-50 border border-amber-100"
                      />
                      <div>
                        <span className="text-sm font-bold text-stone-800">{stu.name}</span>
                        <p className="text-[11px] text-stone-400 mt-0.5">
                          剩余课时：<strong className="text-stone-700">{stu.remaining_hours}</strong> 节
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2.5 sm:border-0 sm:pt-0">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleAdjustHours(stu, -1)}
                          className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-600 border border-rose-200 active:scale-95"
                        >
                          消课 -1
                        </button>
                        <button
                          onClick={() => handleAdjustHours(stu, 1)}
                          className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-600 border border-emerald-200 active:scale-95"
                        >
                          +1 节
                        </button>
                        <button
                          onClick={() => handleAdjustHours(stu, 10)}
                          className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-600 border border-emerald-200 active:scale-95"
                        >
                          续费 +10
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopyInvite(stu)}
                          className="flex items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-700"
                        >
                          {copiedId === stu.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span className="text-emerald-600">已复制分享</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>复制分享通知</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setEditingStudentId(stu.id);
                            setStuName(stu.name);
                            setStuHours(String(stu.remaining_hours));
                          }}
                          className="rounded-lg bg-stone-100 p-1.5 text-stone-600"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(stu)}
                          className="rounded-lg bg-rose-50 p-1.5 text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== 模块 2：教学周次/课程管理 ==================== */}
          {activeSection === 'weeks' && (
            <div className="space-y-4">
              <form
                onSubmit={handleSaveWeek}
                className="rounded-3xl bg-white p-4 shadow-sm border border-stone-100 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-amber-500" />
                    <span>{editingWeekId ? '编辑教学周次' : '新增教学周次/课程主题'}</span>
                  </h3>
                  {editingWeekId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingWeekId(null);
                        setWeekTitle('');
                        setWeekDesc('');
                      }}
                      className="text-[11px] text-stone-400 underline"
                    >
                      取消编辑
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    value={weekCode}
                    onChange={(e) => setWeekCode(e.target.value)}
                    placeholder="周次编码 (如 2026-W45)"
                    className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold"
                  />
                  <input
                    type="date"
                    value={weekDate}
                    onChange={(e) => setWeekDate(e.target.value)}
                    className="rounded-xl border border-stone-200 px-3 py-2 text-xs"
                  />
                </div>

                <input
                  type="text"
                  required
                  value={weekTitle}
                  onChange={(e) => setWeekTitle(e.target.value)}
                  placeholder="课程主题名称（如：莫奈的睡莲池塘）"
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs"
                />

                <textarea
                  rows={2}
                  value={weekDesc}
                  onChange={(e) => setWeekDesc(e.target.value)}
                  placeholder="技法与要点说明（如：学习印象派点彩笔触与水面光影倒影表现）"
                  className="w-full rounded-xl border border-stone-200 p-3 text-xs"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-stone-900 py-2.5 text-xs font-bold text-white"
                >
                  {editingWeekId ? '保存课程周次修改' : '发布新教学周次'}
                </button>
              </form>

              <div className="space-y-2.5">
                {weeks.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-start justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm border border-stone-100"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                          {w.week_code}
                        </span>
                        <h4 className="text-sm font-bold text-stone-800">{w.title}</h4>
                      </div>
                      <p className="text-xs text-stone-500">{w.theme_desc}</p>
                      <p className="text-[10px] text-stone-400">开课日期：{w.start_date}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setEditingWeekId(w.id);
                          setWeekCode(w.week_code);
                          setWeekTitle(w.title);
                          setWeekDesc(w.theme_desc || '');
                          setWeekDate(w.start_date);
                        }}
                        className="rounded-lg bg-stone-100 p-1.5 text-stone-600"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteWeek(w)}
                        className="rounded-lg bg-rose-50 p-1.5 text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== 模块 3：作品、分类与光影画廊精选管理 ==================== */}
          {activeSection === 'artworks' && (
            <div className="space-y-4">
              {editingArtwork && (
                <form
                  onSubmit={handleUpdateArtwork}
                  className="rounded-3xl bg-amber-50/70 p-4 border border-amber-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-amber-900">
                      编辑作品：《{editingArtwork.title}》
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditingArtwork(null)}
                      className="text-xs text-stone-500 underline"
                    >
                      取消
                    </button>
                  </div>
                  <input
                    type="text"
                    value={artTitle}
                    onChange={(e) => setArtTitle(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs"
                    placeholder="作品名称"
                  />

                  {/* 作品分类编辑（预设快选 + 自定义输入） */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-stone-600">
                      作品分类（可直接输入自定义分类）：
                    </label>
                    <input
                      type="text"
                      value={artCategory}
                      onChange={(e) => setArtCategory(e.target.value)}
                      placeholder="如：原创、水彩、素描、儿童画..."
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_CATEGORIES.map((c) => (
                        <button
                          type="button"
                          key={c}
                          onClick={() => setArtCategory(c)}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                            artCategory === c
                              ? 'border-stone-900 bg-stone-900 text-white'
                              : 'border-stone-200 bg-white text-stone-600'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-white p-1 border border-stone-200">
                    {STAGES.map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => setArtStage(s)}
                        className={`rounded-lg py-1.5 text-xs font-medium ${
                          artStage === s ? 'bg-amber-500 text-white' : 'text-stone-600'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <label className="flex items-center gap-2 rounded-xl bg-white p-2.5 border border-stone-200 text-xs font-medium text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={artFeatured}
                      onChange={(e) => setArtFeatured(e.target.checked)}
                      className="h-4 w-4 accent-amber-500"
                    />
                    <span>⭐ 选入首页「光影画廊」精选展示</span>
                  </label>

                  <textarea
                    rows={3}
                    value={artComment}
                    onChange={(e) => setArtComment(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-white p-3 text-xs"
                    placeholder="老师专业评语"
                  />
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-stone-900 py-2.5 text-xs font-bold text-white"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>保存修改</span>
                  </button>
                </form>
              )}

              <div className="space-y-2.5">
                {artworks.map((art) => {
                  const featured = isArtworkFeatured(art);
                  const cat = getArtworkCategory(art);
                  return (
                    <div
                      key={art.id}
                      className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm border border-stone-100"
                    >
                      <img
                        src={art.image_url}
                        alt={art.title}
                        className="h-16 w-16 shrink-0 rounded-xl object-cover bg-stone-100"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            {art.students?.name || '学员'}
                          </span>
                          <span className="rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-medium text-white">
                            {cat}
                          </span>
                          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
                            {art.stage}
                          </span>
                        </div>
                        <h4 className="truncate text-xs font-bold text-stone-800 mt-1">
                          《{art.title}》
                        </h4>
                        <p className="truncate text-[11px] text-stone-400">
                          {art.teacher_comment || '暂无评语'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleToggleFeatured(art)}
                          title={featured ? '点击移出光影画廊' : '点击选入光影画廊'}
                          className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold border transition ${
                            featured
                              ? 'border-amber-400 bg-amber-50 text-amber-700'
                              : 'border-stone-200 bg-stone-50 text-stone-400'
                          }`}
                        >
                          <Star className={`h-3.5 w-3.5 ${featured ? 'fill-amber-400 text-amber-500' : ''}`} />
                          <span>{featured ? '已精选' : '设精选'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingArtwork(art);
                            setArtTitle(art.title);
                            setArtStage(art.stage);
                            setArtCategory(cat);
                            setArtFeatured(featured);
                            setArtComment(art.teacher_comment || '');
                          }}
                          className="rounded-lg bg-stone-100 p-2 text-stone-600"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteArtwork(art)}
                          className="rounded-lg bg-rose-50 p-2 text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== 模块 4：评论管理 ==================== */}
          {activeSection === 'comments' && (
            <div className="space-y-2.5">
              {allComments.length === 0 ? (
                <div className="rounded-2xl bg-white p-8 text-center text-xs text-stone-400">
                  暂无互动评论记录
                </div>
              ) : (
                allComments.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3.5 shadow-sm border border-stone-100"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-800">{c.author_name}</span>
                        <span className="text-[10px] text-stone-400">
                          评论了《{c.artworks?.title || '画作'}》
                        </span>
                      </div>
                      <p className="text-xs text-stone-600">{c.content}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteComment(c.id)}
                      className="rounded-lg bg-rose-50 p-2 text-rose-500 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
