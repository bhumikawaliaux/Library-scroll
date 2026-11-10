import React, { useState } from 'react';
import { Book, getBookCoverUrl } from '../data/books';

export function renderStars(rating: number) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 !== 0;
  return (
    <div className="flex items-center gap-0.5 text-amber-500" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => {
        if (i < fullStars) {
          return (
            <span key={i} className="text-[14px] leading-none">
              ★
            </span>
          );
        }
        if (i === fullStars && hasHalf) {
          return (
            <span key={i} className="text-[14px] leading-none opacity-85">
              ★
            </span>
          );
        }
        return (
          <span key={i} className="text-[14px] leading-none text-stone-300">
            ★
          </span>
        );
      })}
    </div>
  );
}

// Front Cover Design for the 3D Book & Center Display
export function BookCoverFace({ book }: { book: Book }) {
  const [imgError, setImgError] = useState(false);
  const coverUrl = getBookCoverUrl(book);

  return (
    <div
      className="w-full h-full relative select-none overflow-hidden rounded-r-[3px] bg-stone-900"
      style={{
        boxShadow:
          'inset 5px 0 12px rgba(0,0,0,0.5), inset -1px 0 3px rgba(255,255,255,0.18), 0 30px 60px -15px rgba(0,0,0,0.5)',
      }}
    >
      {/* Real original book cover image */}
      {!imgError ? (
        <img
          src={coverUrl}
          alt={book.title}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-fill object-center"
        />
      ) : (
        /* Styled Fallback Cover */
        <div
          className="w-full h-full flex flex-col justify-between p-6 text-center relative border border-white/10"
          style={{ backgroundColor: book.spineBg, color: book.spineText }}
        >
          <div className="text-[11px] tracking-[0.22em] uppercase font-bold opacity-85 pt-2">
            {book.author}
          </div>
          <div className="my-auto">
            <h3 className="font-serif text-[22px] font-semibold leading-tight px-2">
              {book.title}
            </h3>
          </div>
        </div>
      )}

      {/* Realistic Book Hinge / Left Spine Crease highlight */}
      <div className="absolute left-[14px] top-0 bottom-0 w-[1.5px] bg-black/45 shadow-[1px_0_0_rgba(255,255,255,0.18)] pointer-events-none" />

      {/* Subtle paper gloss gradient */}
      <div className="absolute inset-0 bg-gradient-to-tr from-black/15 via-transparent to-white/10 pointer-events-none" />
    </div>
  );
}

// Spine Face for the 3D Book (matching the real shelf screenshot)
export function BookSpineFace({ book }: { book: Book }) {
  const authorName = book.author.split(' ').pop()?.toUpperCase() || book.author.toUpperCase();

  // Custom visual flourishes based on real book publishers
  const isPenguin = book.spinePattern === 'penguin';
  const isMinimalWhite = book.spinePattern === 'minimal-white';
  const isCaution = book.spinePattern === 'caution';
  const isGoldFoil = book.spinePattern === 'gold-foil';
  const isVintage = book.spinePattern === 'vintage';

  return (
    <div
      className="w-full h-full relative flex flex-col justify-between items-center py-2 px-0.5 select-none overflow-hidden"
      style={{
        backgroundColor: book.spineBg,
        color: book.spineText,
        boxShadow:
          'inset -3px 0 6px rgba(0,0,0,0.4), inset 3px 0 6px rgba(255,255,255,0.15)',
      }}
    >
      {/* Top Headband Cloth Stitch */}
      <div className="w-full flex flex-col items-center gap-0.5 opacity-85 shrink-0">
        <div className="w-full h-[3.5px] bg-black/40" />
        <div className="w-[85%] h-[1px] bg-white/20" />
      </div>

      {/* Top Author or Series Brand */}
      <div className="shrink-0 flex flex-col items-center mt-1 px-0.5 w-full">
        {isPenguin ? (
          <div className="w-[70%] h-[3px] bg-amber-600 mb-1 rounded-[0.5px]" />
        ) : isVintage ? (
          <div className="w-[8px] h-[8px] rounded-full bg-emerald-600 mb-1" />
        ) : isCaution ? (
          <div className="text-[6.5px] font-mono tracking-tighter bg-red-600 text-white px-1 py-0.5 font-bold uppercase rounded-[1px]">
            EVIDENCE
          </div>
        ) : null}

        <span className="text-[8px] font-sans tracking-[0.14em] font-semibold uppercase text-center line-clamp-1 opacity-90">
          {authorName}
        </span>
      </div>

      {/* Spine Title (Vertical text) */}
      <div className="my-auto flex items-center justify-center py-1 h-[68%] overflow-hidden w-full">
        <span
          className={`font-serif text-[12.5px] tracking-[0.06em] font-medium whitespace-nowrap text-ellipsis ${
            isGoldFoil ? 'text-amber-200 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]' : ''
          }`}
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            maxHeight: '100%',
          }}
        >
          {book.title}
        </span>
      </div>

      {/* Bottom: Tail stitch / spine finish */}
      <div className="w-full flex flex-col items-center gap-1 opacity-80 shrink-0 mb-1">
        <div className="w-[80%] h-[1px] bg-white/20" />
        <div className="w-full h-[3px] bg-black/40" />
      </div>

      {/* Embossed longitudinal groove line for realistic 3D rounded spine */}
      <div className="absolute inset-y-0 left-0 w-[2px] bg-black/20 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-[2px] bg-black/30 pointer-events-none" />
    </div>
  );
}

// Left / Back Face for the 3D Book on the Shelf
// (Fixes Request 3: Gives books on the right identical 3D realism, depth, and page textures)
export function BookLeftFace({ book }: { book: Book }) {
  return (
    <div
      className="w-full h-full relative select-none overflow-hidden rounded-l-[3px]"
      style={{
        backgroundColor: book.spineBg,
        boxShadow:
          'inset -5px 0 12px rgba(0,0,0,0.45), inset 1px 0 3px rgba(255,255,255,0.15), 0 30px 60px -15px rgba(0,0,0,0.5)',
      }}
    >
      {/* Back Cover Board Surface */}
      <div className="absolute inset-0 bg-black/10" />

      {/* Pages Block (fore-edge paper block inside the cover boards) */}
      <div
        className="absolute left-[3px] top-[3px] bottom-[3px] w-[80%] rounded-r-[1px] overflow-hidden"
        style={{
          background: 'linear-gradient(to right, #FAF7F0 0%, #F3EDE0 40%, #E6DBC6 100%)',
          boxShadow: 'inset -2px 0 6px rgba(0,0,0,0.35)',
        }}
      >
        {/* Repeating fine paper leaf lines for page block texture */}
        <div
          className="w-full h-full opacity-40"
          style={{
            background:
              'repeating-linear-gradient(0deg, transparent, transparent 1.5px, rgba(130,105,70,0.3) 1.5px, rgba(130,105,70,0.3) 2px)',
          }}
        />
        {/* Paper aging gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/5 via-transparent to-amber-900/10 pointer-events-none" />
      </div>

      {/* Rear Cover Board Turn-in Lip */}
      <div className="absolute inset-y-0 right-0 w-[4px] bg-black/30 pointer-events-none" />
      <div className="absolute inset-y-0 left-0 w-[2px] bg-black/40 pointer-events-none" />

      {/* Light crease near spine joint */}
      <div className="absolute right-[12px] top-0 bottom-0 w-[1.5px] bg-black/40 shadow-[-1px_0_0_rgba(255,255,255,0.15)] pointer-events-none" />

      {/* Subtle depth gradient across the face */}
      <div className="absolute inset-0 bg-gradient-to-l from-black/25 via-transparent to-white/10 pointer-events-none" />
    </div>
  );
}

