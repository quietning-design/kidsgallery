import React, { useState } from 'react';
import { Sparkles, KeyRound, Eye, ArrowRight } from 'lucide-react';
import { Student } from '../lib/supabase';

interface PasscodeModalProps {
  isOpen: boolean;
  students: Student[];
  onSelectStudent: (student: Student) => void;
  onDismissAsGuest: () => void;
}

export const PasscodeModal: React.FC<PasscodeModalProps> = ({
  isOpen,
  students,
  onSelectStudent,
  onDismissAsGuest,
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const matched = students.find((s) => s.passcode.toUpperCase() === cleanCode);

    if (matched) {
      localStorage.setItem('gallery_passcode', matched.passcode);
      localStorage.setItem('gallery_parent_nickname', `${matched.name}家长`);
      setError('');
      onSelectStudent(matched);
    } else {
      setError('未找到对应的成长暗号，请核对或试试演示暗号：BEN2026');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-5">
      <div className="w-full max-w-sm rounded-3xl bg-[#FFFDF9] p-6 shadow-2xl border border-amber-100">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
          <Sparkles className="h-6 w-6" />
        </div>

        <h2 className="text-center text-xl font-bold text-stone-800">
          欢迎来到少儿成长美术馆
        </h2>
        <p className="mt-1.5 text-center text-xs text-stone-500 leading-relaxed">
          输入孩子的专属家庭暗号，直达专属成长时光机
        </p>

        <form onSubmit={handleVerify} className="mt-5 space-y-3">
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-3.5 h-5 w-5 text-stone-400" />
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="例如：BEN2026"
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 py-3 pl-11 pr-4 text-sm font-semibold uppercase tracking-wider text-stone-800 placeholder:normal-case placeholder:font-normal focus:border-amber-500 focus:bg-white focus:outline-none"
            />
          </div>

          {error && <p className="text-xs text-rose-500 px-1">{error}</p>}

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3.5 text-sm font-semibold text-white shadow-md shadow-amber-500/20 active:scale-[0.98] transition"
          >
            <span>开启孩子的时光轴</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-stone-200" />
          <span className="text-[11px] text-stone-400">或免密快速体验</span>
          <div className="h-px flex-1 bg-stone-200" />
        </div>

        <button
          onClick={onDismissAsGuest}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-white py-3 text-xs font-medium text-stone-600 active:bg-stone-50"
        >
          <Eye className="h-4 w-4 text-stone-400" />
          <span>以访客身份浏览公开展厅</span>
        </button>
      </div>
    </div>
  );
};
