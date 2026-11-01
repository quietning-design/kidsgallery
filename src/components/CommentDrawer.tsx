import React, { useEffect, useState } from 'react';
import { X, Send, MessageCircleHeart, UserCheck, Edit2 } from 'lucide-react';
import { supabase, Artwork, CommentItem, isSupabaseConfigured } from '../lib/supabase';

interface CommentDrawerProps {
  artwork: Artwork | null;
  isTeacher: boolean;
  onClose: () => void;
}

const STORAGE_NAME_KEY = 'gallery_parent_nickname';

export const CommentDrawer: React.FC<CommentDrawerProps> = ({
  artwork,
  isTeacher,
  onClose,
}) => {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [authorName, setAuthorName] = useState(
    () => localStorage.getItem(STORAGE_NAME_KEY) || ''
  );
  const [isEditingName, setIsEditingName] = useState(
    () => !localStorage.getItem(STORAGE_NAME_KEY)
  );
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!artwork) return;

    const savedName = localStorage.getItem(STORAGE_NAME_KEY) || '';
    if (savedName) {
      setAuthorName(savedName);
      setIsEditingName(false);
    } else if (isTeacher) {
      setAuthorName('指导老师');
      setIsEditingName(false);
    } else {
      setIsEditingName(true);
    }

    if (!isSupabaseConfigured) {
      setComments(artwork.comments || []);
      return;
    }

    // 1. 初始拉取该作品评论
    const fetchComments = async () => {
      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('artwork_id', artwork.id)
        .order('created_at', { ascending: true });
      if (data) setComments(data);
    };
    fetchComments();

    // 2. 订阅 Supabase Database Realtime 实现多端无刷新同步
    const channel = supabase
      .channel(`comments-room-${artwork.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `artwork_id=eq.${artwork.id}`,
        },
        (payload) => {
          const newComment = payload.new as CommentItem;
          setComments((prev) => {
            const filtered = prev.filter(
              (c) =>
                !(
                  c.isOptimistic &&
                  c.content === newComment.content &&
                  c.author_name === newComment.author_name
                )
            );
            if (filtered.some((c) => c.id === newComment.id)) return filtered;
            return [...filtered, newComment];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [artwork, isTeacher]);

  if (!artwork) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = authorName.trim() || (isTeacher ? '指导老师' : '');
    if (!cleanName) {
      setIsEditingName(true);
      return alert('请先输入您的称呼（如：奔奔妈妈），之后系统会自动记住，下次无需再填～');
    }
    const cleanContent = content.trim();
    if (!cleanContent) return;

    // 永久记住评论人昵称，下次无需再录入
    localStorage.setItem(STORAGE_NAME_KEY, cleanName);
    setAuthorName(cleanName);
    setIsEditingName(false);

    // 1. Optimistic UI 乐观渲染立即上屏
    const tempId = `temp-${Date.now()}`;
    const optimisticItem: CommentItem = {
      id: tempId,
      artwork_id: artwork.id,
      author_name: cleanName,
      author_role: isTeacher ? 'teacher' : 'parent',
      content: cleanContent,
      created_at: new Date().toISOString(),
      isOptimistic: true,
    };

    setComments((prev) => [...prev, optimisticItem]);
    setContent('');

    if (!isSupabaseConfigured) return;

    // 2. 异步写入 Supabase
    const { data, error } = await supabase
      .from('comments')
      .insert({
        artwork_id: artwork.id,
        author_name: cleanName,
        author_role: isTeacher ? 'teacher' : 'parent',
        content: cleanContent,
      })
      .select()
      .single();

    if (error) {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      alert('发送失败：' + error.message);
    } else if (data) {
      setComments((prev) => prev.map((c) => (c.id === tempId ? data : c)));
    }
  };

  // 排序：老师评论置顶在前，其他评论按时间在后
  const sortedComments = [...comments].sort((a, b) => {
    if (a.author_role === 'teacher' && b.author_role !== 'teacher') return -1;
    if (a.author_role !== 'teacher' && b.author_role === 'teacher') return 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm">
      <div className="flex max-h-[82vh] w-full max-w-md mx-auto flex-col rounded-t-3xl bg-[#FFFDF9] shadow-2xl">
        {/* 顶部作品摘要 */}
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <MessageCircleHeart className="h-5 w-5 text-amber-500" />
            <div>
              <h4 className="text-sm font-bold text-stone-800">
                《{artwork.title}》互动鼓励墙
              </h4>
              <p className="text-[11px] text-stone-400">
                免密直接留言 · 自动记住您的称呼
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-stone-100 p-1.5 text-stone-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 评论列表 */}
        <div className="flex-1 space-y-2.5 overflow-y-auto p-5">
          {artwork.teacher_comment && (
            <div className="rounded-2xl bg-amber-50/90 border border-amber-200 p-3 text-xs">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  置顶 · 老师专业点评
                </span>
              </div>
              <p className="text-stone-800 font-medium leading-relaxed">
                {artwork.teacher_comment}
              </p>
            </div>
          )}

          {sortedComments.length === 0 ? (
            <p className="py-8 text-center text-xs text-stone-400">
              还没有亲友评论，快来给小画家送上一句鼓励吧～
            </p>
          ) : (
            sortedComments.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl p-3 text-xs transition ${
                  item.author_role === 'teacher'
                    ? 'bg-amber-50/80 border border-amber-200/70'
                    : 'bg-stone-100/80'
                } ${item.isOptimistic ? 'opacity-70' : 'opacity-100'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-stone-800">{item.author_name}</span>
                    {item.author_role === 'teacher' && (
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                        置顶 · 老师
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-stone-400">
                    {new Date(item.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-stone-700 leading-relaxed">{item.content}</p>
              </div>
            ))
          )}
        </div>

        {/* 底部输入栏：自动记住昵称，下次无需再填 */}
        <form
          onSubmit={handleSend}
          className="border-t border-stone-100 bg-white p-3.5 space-y-2.5 pb-6"
        >
          {!isEditingName && authorName.trim() ? (
            <div className="flex items-center justify-between px-1 text-[11px] text-stone-500">
              <span className="flex items-center gap-1">
                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                当前留言身份：<strong className="text-stone-800">{authorName}</strong>
                <span className="text-stone-400">（已自动记住）</span>
              </span>
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="flex items-center gap-0.5 text-amber-600 font-medium hover:underline"
              >
                <Edit2 className="h-3 w-3" />
                <span>修改称呼</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-stone-600 shrink-0">您的称呼：</span>
              <input
                type="text"
                required
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="首次留言请填称呼（如：奔奔妈妈），下次免填"
                className="flex-1 rounded-xl border border-amber-300 bg-amber-50/40 px-3 py-1.5 text-xs text-stone-800 focus:border-amber-500 focus:bg-white focus:outline-none"
              />
            </div>
          )}

          <div className="relative flex items-center">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="写下对画作的鼓励与夸奖..."
              className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-3.5 pr-11 text-xs text-stone-800 focus:border-amber-500 focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              className="absolute right-1.5 rounded-lg bg-amber-500 p-1.5 text-white active:scale-95"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
