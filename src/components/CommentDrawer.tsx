import React, { useEffect, useState } from 'react';
import { X, Send, MessageCircleHeart } from 'lucide-react';
import { supabase, Artwork, CommentItem, isSupabaseConfigured } from '../lib/supabase';

interface CommentDrawerProps {
  artwork: Artwork | null;
  isTeacher: boolean;
  onClose: () => void;
}

export const CommentDrawer: React.FC<CommentDrawerProps> = ({
  artwork,
  isTeacher,
  onClose,
}) => {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [authorName, setAuthorName] = useState(
    () => localStorage.getItem('gallery_parent_nickname') || ''
  );
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!artwork) return;

    if (!isSupabaseConfigured) {
      setComments([
        {
          id: 'demo-c1',
          artwork_id: artwork.id,
          author_name: '李老师',
          author_role: 'teacher',
          content: '今天色彩搭配非常大胆，继续保持这份想象力！',
          created_at: new Date().toISOString(),
        },
      ]);
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
  }, [artwork]);

  if (!artwork) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = authorName.trim() || (isTeacher ? '画室老师' : '热心家长');
    const cleanContent = content.trim();
    if (!cleanContent) return;

    localStorage.setItem('gallery_parent_nickname', cleanName);

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-md mx-auto flex-col rounded-t-3xl bg-[#FFFDF9] shadow-2xl">
        {/* 顶部作品摘要 */}
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <MessageCircleHeart className="h-5 w-5 text-amber-500" />
            <div>
              <h4 className="text-sm font-bold text-stone-800">
                《{artwork.title}》互动鼓励墙
              </h4>
              <p className="text-[11px] text-stone-400">
                实时同步 · 给小画家送上一句温暖夸奖吧
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-stone-100 p-1.5 text-stone-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 评论列表 */}
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {comments.length === 0 ? (
            <p className="py-10 text-center text-xs text-stone-400">
              还没有评论，快来抢占第一个小红花鼓励吧～
            </p>
          ) : (
            comments.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl p-3 text-xs transition ${
                  item.author_role === 'teacher'
                    ? 'bg-amber-50/90 border border-amber-200/70'
                    : 'bg-stone-100/80'
                } ${item.isOptimistic ? 'opacity-70' : 'opacity-100'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-stone-800">{item.author_name}</span>
                    {item.author_role === 'teacher' && (
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                        指导老师
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

        {/* 底部输入栏 */}
        <form
          onSubmit={handleSend}
          className="border-t border-stone-100 bg-white p-3.5 space-y-2 pb-6"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="您的称呼 (如: 奔奔妈妈)"
              className="w-32 shrink-0 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-800 focus:border-amber-500 focus:outline-none"
            />
            <div className="relative flex-1">
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="写下对画作的鼓励..."
                className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-3 pr-10 text-xs text-stone-800 focus:border-amber-500 focus:outline-none"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1 rounded-lg bg-amber-500 p-1.5 text-white active:scale-95"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
