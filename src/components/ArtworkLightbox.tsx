import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, Sparkles } from 'lucide-react';
import { Artwork } from '../lib/supabase';

interface ArtworkLightboxProps {
  artwork: Artwork | null;
  relatedStages: Artwork[];
  onSelectArtwork: (art: Artwork) => void;
  onClose: () => void;
}

export const ArtworkLightbox: React.FC<ArtworkLightboxProps> = ({
  artwork,
  relatedStages,
  onSelectArtwork,
  onClose,
}) => {
  const [scale, setScale] = useState(1);

  if (!artwork) return null;

  const toggleZoom = () => setScale((prev) => (prev === 1 ? 2 : 1));

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 text-white p-4">
      {/* 顶部控制栏 */}
      <div className="flex items-center justify-between z-10 max-w-md w-full mx-auto">
        <div>
          <span className="inline-block rounded-full bg-amber-500/20 border border-amber-400/40 px-2.5 py-0.5 text-[11px] text-amber-300">
            {artwork.stage}
          </span>
          <h3 className="mt-1 text-base font-bold">{artwork.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleZoom}
            className="rounded-full bg-white/10 p-2.5 text-white backdrop-blur-md"
          >
            {scale === 1 ? <ZoomIn className="h-5 w-5" /> : <ZoomOut className="h-5 w-5" />}
          </button>
          <button
            onClick={() => {
              setScale(1);
              onClose();
            }}
            className="rounded-full bg-white/10 p-2.5 text-white backdrop-blur-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 中部画作展示（支持手势捏合 touch-pinch-zoom 与点击放大） */}
      <div className="relative my-auto flex max-h-[68vh] items-center justify-center overflow-auto touch-pinch-zoom">
        <img
          src={artwork.image_url}
          alt={artwork.title}
          onDoubleClick={toggleZoom}
          style={{ transform: `scale(${scale})`, transition: 'transform 0.25s ease' }}
          className="max-h-[65vh] w-auto rounded-lg object-contain select-none"
        />
      </div>

      {/* 底部：阶段演变切换 + 老师评语 */}
      <div className="max-w-md w-full mx-auto space-y-3 rounded-2xl bg-stone-900/90 p-4 backdrop-blur-md border border-white/10">
        {relatedStages.length > 1 && (
          <div>
            <p className="text-[11px] text-stone-400 mb-2">创作阶段演变（点击切换对比）：</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {relatedStages.map((stageArt) => (
                <button
                  key={stageArt.id}
                  onClick={() => {
                    setScale(1);
                    onSelectArtwork(stageArt);
                  }}
                  className={`flex items-center gap-2 shrink-0 rounded-xl p-1.5 pr-3 border text-left transition ${
                    stageArt.id === artwork.id
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-white/10 bg-white/5 text-stone-300'
                  }`}
                >
                  <img
                    src={stageArt.image_url}
                    alt={stageArt.stage}
                    className="h-8 w-8 rounded-lg object-cover"
                  />
                  <span className="text-xs font-medium">{stageArt.stage}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {artwork.teacher_comment && (
          <div className="flex gap-2 text-xs text-stone-200 leading-relaxed">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <p>{artwork.teacher_comment}</p>
          </div>
        )}
      </div>
    </div>
  );
};
