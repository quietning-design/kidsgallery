import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  ImagePlus,
  UploadCloud,
  X,
  Loader2,
  Sparkles,
  Plus,
  Star,
  Palette,
} from 'lucide-react';
import {
  supabase,
  Student,
  CurriculumWeek,
  StageType,
  PRESET_CATEGORIES,
  buildTagsWithMeta,
} from '../lib/supabase';
import { compressToWebP, CompressedResult } from '../lib/imageCompressor';

interface TeacherUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  weeks: CurriculumWeek[];
  existingCategories: string[];
  onUploadSuccess: () => void;
}

const PRESET_TAGS = ['色彩对比', '构图饱满', '线条流畅', '天马行空', '观察细致', '笔触大胆', '专注投入'];
const STAGES: StageType[] = ['草图构思', '色彩打底', '最终成作'];
const CUSTOM_CAT_STORAGE_KEY = 'gallery_custom_categories';

export const TeacherUploadModal: React.FC<TeacherUploadModalProps> = ({
  isOpen,
  onClose,
  students,
  weeks,
  existingCategories,
  onUploadSuccess,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [stage, setStage] = useState<StageType>('最终成作');
  const [category, setCategory] = useState<string>('儿童画');
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_CAT_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [showCustomCatInput, setShowCustomCatInput] = useState(false);
  const [newCatText, setNewCatText] = useState('');
  const [isFeatured, setIsFeatured] = useState(true);

  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['色彩对比']);
  const [compressedItems, setCompressedItems] = useState<CompressedResult[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);
  const uploadingLockRef = useRef(false);

  useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
    if (weeks.length > 0 && !selectedWeekId) {
      setSelectedWeekId(weeks[0].id);
    }
  }, [students, weeks, selectedStudentId, selectedWeekId]);

  if (!isOpen) return null;

  // 合并预设分类 + 历史作品分类 + 老师本地自定义分类（去重）
  const allCategories = Array.from(
    new Set([...PRESET_CATEGORIES, ...existingCategories, ...customCategories])
  );

  const handleAddCustomCategory = () => {
    const clean = newCatText.trim();
    if (!clean) return;
    if (!customCategories.includes(clean)) {
      const updated = [...customCategories, clean];
      setCustomCategories(updated);
      localStorage.setItem(CUSTOM_CAT_STORAGE_KEY, JSON.stringify(updated));
    }
    setCategory(clean);
    setNewCatText('');
    setShowCustomCatInput(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setIsCompressing(true);
    try {
      const results: CompressedResult[] = [];
      for (const file of files) {
        const res = await compressToWebP(file, 1600, 300);
        results.push(res);
      }
      setCompressedItems((prev) => [...prev, ...results]);
    } catch (err: any) {
      alert('图片压缩失败: ' + err.message);
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const removePreview = (idx: number) => {
    setCompressedItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadingLockRef.current || isUploading) return;
    if (!compressedItems.length) return alert('请先拍照或选择画作图片');
    if (!selectedStudentId || !selectedWeekId) return alert('请选择学员与教学周次');

    uploadingLockRef.current = true;
    setIsUploading(true);
    try {
      const finalTags = buildTagsWithMeta(selectedTags, category, isFeatured);

      for (let i = 0; i < compressedItems.length; i++) {
        const item = compressedItems[i];
        const ext = item.file.type === 'image/webp' ? 'webp' : 'jpg';
        const uniqueKey = `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 9)}`;
        const storagePath = `artworks/${selectedStudentId}/${uniqueKey}.${ext}`;

        // 1. 上传压缩后的 WebP 至 Supabase Storage（每次生成唯一随机路径，杜绝 The resource already exists）
        const { error: uploadErr } = await supabase.storage
          .from('artworks-storage')
          .upload(storagePath, item.file, {
            contentType: item.file.type,
            upsert: false,
          });

        if (uploadErr) throw uploadErr;

        // 2. 获取公开 CDN URL
        const { data: publicUrlData } = supabase.storage
          .from('artworks-storage')
          .getPublicUrl(storagePath);

        // 3. 写入 artworks 表
        const artworkTitle =
          compressedItems.length > 1
            ? `${title || '课堂习作'} (${i + 1})`
            : title || '课堂创作记录';

        const { error: insertErr } = await supabase.from('artworks').insert({
          student_id: selectedStudentId,
          week_id: selectedWeekId,
          title: artworkTitle,
          image_url: publicUrlData.publicUrl,
          stage,
          teacher_comment: comment.trim(),
          tags: finalTags,
        });

        if (insertErr) throw insertErr;
      }

      setCompressedItems([]);
      setTitle('');
      setComment('');
      onUploadSuccess();
      onClose();
    } catch (err: any) {
      alert('上传失败：' + (err.message || '请检查老师登录状态'));
    } finally {
      uploadingLockRef.current = false;
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-[#FFFDF9] p-5 shadow-2xl max-w-md mx-auto">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-stone-800">随堂拍照与点评上传</h3>
            <p className="text-[11px] text-emerald-600 font-medium">
              已启用 WebP 极速压缩引擎 (自动 ≤1600px & ≤300KB)
            </p>
          </div>
          <button onClick={onClose} className="rounded-full bg-stone-100 p-2 text-stone-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 pb-6">
          {/* 1. 拍照 / 相册双入口 */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/60 py-4 text-amber-700 active:scale-95 transition"
            >
              <Camera className="h-6 w-6" />
              <span className="text-xs font-semibold">手机相机直拍</span>
            </button>

            <button
              type="button"
              onClick={() => albumInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 py-4 text-stone-600 active:scale-95 transition"
            >
              <ImagePlus className="h-6 w-6" />
              <span className="text-xs font-semibold">相册批量选择</span>
            </button>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={albumInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* 压缩状态与缩略图预览 */}
          {isCompressing && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>正在将原图压制为高清 WebP...</span>
            </div>
          )}

          {compressedItems.length > 0 && (
            <div className="flex gap-3 overflow-x-auto py-1 no-scrollbar">
              {compressedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-stone-200"
                >
                  <img src={item.previewUrl} alt="preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePreview(idx)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-black/65 px-1.5 py-0.5 text-[9px] text-emerald-300 text-center">
                    {item.originalSizeKB}K → {item.compressedSizeKB}KB
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 2. 选择学员（胶囊快选） */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-2">选择学员</label>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {students.map((stu) => (
                <button
                  type="button"
                  key={stu.id}
                  onClick={() => setSelectedStudentId(stu.id)}
                  className={`flex items-center gap-2 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium border transition ${
                    selectedStudentId === stu.id
                      ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                      : 'border-stone-200 bg-white text-stone-700'
                  }`}
                >
                  <img src={stu.avatar_url} alt={stu.name} className="h-5 w-5 rounded-full bg-stone-100" />
                  <span>{stu.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. 新增：作品分类（原创、水彩、素描、儿童画 + 自定义分类） */}
          <div>
            <label className="flex items-center justify-between text-xs font-semibold text-stone-600 mb-2">
              <span className="flex items-center gap-1">
                <Palette className="h-3.5 w-3.5 text-amber-500" />
                作品分类（支持自定义）
              </span>
              <button
                type="button"
                onClick={() => setShowCustomCatInput((v) => !v)}
                className="flex items-center gap-0.5 text-[11px] font-semibold text-amber-600"
              >
                <Plus className="h-3 w-3" />
                <span>自定义新分类</span>
              </button>
            </label>

            {showCustomCatInput && (
              <div className="mb-2.5 flex gap-2">
                <input
                  type="text"
                  value={newCatText}
                  onChange={(e) => setNewCatText(e.target.value)}
                  placeholder="输入新分类名称（如：国画、版画、速写）"
                  className="flex-1 rounded-xl border border-amber-300 bg-amber-50/40 px-3 py-1.5 text-xs text-stone-800 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCustomCategory}
                  className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shrink-0"
                >
                  添加并选中
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {allCategories.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                    category === cat
                      ? 'border-stone-900 bg-stone-900 text-white shadow-sm'
                      : 'border-stone-200 bg-white text-stone-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 4. 选择教学周次与创作阶段 */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5">教学周次（课堂展厅归档）</label>
              <select
                value={selectedWeekId}
                onChange={(e) => setSelectedWeekId(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs text-stone-800"
              >
                {weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.week_code} · {w.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5">创作阶段</label>
              <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-stone-100 p-1">
                {STAGES.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setStage(s)}
                    className={`rounded-lg py-1.5 text-xs font-medium transition ${
                      stage === s ? 'bg-white text-amber-600 shadow-sm' : 'text-stone-500'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 5. 选入首页「光影画廊」精选开关 */}
          <div
            onClick={() => setIsFeatured((v) => !v)}
            className={`flex cursor-pointer items-center justify-between rounded-2xl border p-3 transition ${
              isFeatured
                ? 'border-amber-300 bg-amber-50/70'
                : 'border-stone-200 bg-stone-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                  isFeatured ? 'bg-amber-500 text-white' : 'bg-stone-200 text-stone-500'
                }`}
              >
                <Star className="h-4 w-4 fill-current" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-800">同步推荐至首页「光影画廊」</p>
                <p className="text-[10px] text-stone-500">
                  勾选后该画作将作为画室精选佳作在首页展示
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={() => {}}
              className="h-4 w-4 accent-amber-500"
            />
          </div>

          {/* 6. 作品名称与老师专业评语 */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="作品名称（如：星空下的向日葵）"
              className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs text-stone-800 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="输入随堂观察与鼓励评语（将在个人时光机置顶显示）..."
              className="w-full rounded-xl border border-stone-200 bg-white p-3.5 text-xs text-stone-800 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* 7. 能力标签选择 */}
          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-stone-600 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>点亮能力标签</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_TAGS.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    selectedTags.includes(tag)
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-stone-100 text-stone-500 border border-transparent'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={isUploading || isCompressing}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 py-3.5 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>正在直传云端画廊...</span>
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                <span>一键发布作品 ({compressedItems.length} 张)</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
