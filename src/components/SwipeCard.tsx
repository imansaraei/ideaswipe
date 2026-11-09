import React, { useRef, useEffect } from 'react';
import { Idea } from '../types';
import { useSwipeGesture, SwipeDirection } from '../hooks/useSwipeGesture';
import { Check, X, Tag, Lightbulb, Target } from 'lucide-react';

export interface SwipeCardProps {
  idea: Idea;
  isTopCard?: boolean;
  onSwipe?: (direction: SwipeDirection) => void;
  threshold?: number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  showActions?: boolean;
}

/**
 * Holographic swipe card with dynamic 60fps CSS transform,
 * directional glow feedback (jade = like, rose = pass), stamp indicators,
 * and accessible action buttons.
 */
export const SwipeCard: React.FC<SwipeCardProps> = ({
  idea,
  isTopCard = true,
  onSwipe,
  threshold = 100,
  disabled = false,
  className = '',
  style: externalStyle,
  showActions = true,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const {
    dx,
    isDragging,
    isAnimating,
    glowIntensity,
    glowColor,
    triggerSwipe,
    bind,
    style: gestureStyle,
  } = useSwipeGesture({
    threshold,
    disabled: !isTopCard || disabled,
    onSwipe,
  });

  // Keyboard navigation for active top card
  useEffect(() => {
    if (!isTopCard || disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        triggerSwipe('pass');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        triggerSwipe('like');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTopCard, disabled, triggerSwipe]);

  // Compute dynamic glow border and box shadow
  let dynamicBorderColor = 'rgba(16, 185, 129, 0.2)';
  let dynamicBoxShadow = '0 12px 36px -8px rgba(0, 0, 0, 0.75), 0 0 1px rgba(16, 185, 129, 0.2)';

  if (isTopCard && glowColor === 'jade') {
    dynamicBorderColor = `rgba(16, 185, 129, ${0.3 + glowIntensity * 0.7})`;
    dynamicBoxShadow = `0 0 ${15 + glowIntensity * 30}px rgba(16, 185, 129, ${0.25 + glowIntensity * 0.5}), 0 16px 36px -8px rgba(0, 0, 0, 0.8)`;
  } else if (isTopCard && glowColor === 'rose') {
    dynamicBorderColor = `rgba(244, 63, 94, ${0.3 + glowIntensity * 0.7})`;
    dynamicBoxShadow = `0 0 ${15 + glowIntensity * 30}px rgba(244, 63, 94, ${0.25 + glowIntensity * 0.5}), 0 16px 36px -8px rgba(0, 0, 0, 0.8)`;
  }

  // Merged inline styles
  const mergedStyle: React.CSSProperties = {
    ...(isTopCard ? gestureStyle : externalStyle),
    borderColor: dynamicBorderColor,
    boxShadow: dynamicBoxShadow,
    ...(isTopCard ? externalStyle : {}),
    ...(isTopCard ? gestureStyle : {}),
  };

  // Stamp opacities
  const matchOpacity = isTopCard && glowColor === 'jade' ? Math.min(1, Math.max(0, (dx - 15) / (threshold * 0.7))) : 0;
  const passOpacity = isTopCard && glowColor === 'rose' ? Math.min(1, Math.max(0, (-dx - 15) / (threshold * 0.7))) : 0;

  return (
    <div
      ref={cardRef}
      data-testid="swipe-card"
      data-card-id={idea.id}
      data-dragging={isDragging ? 'true' : 'false'}
      tabIndex={isTopCard ? 0 : -1}
      aria-label={`Idea card: ${idea.title}`}
      className={`relative w-full max-w-md rounded-2xl p-6 bg-gradient-to-b from-[#0e271e] via-[#091b14] to-[#040e0a] border text-mint transition-colors select-none ${className}`}
      style={mergedStyle}
      {...(isTopCard ? bind : {})}
    >
      {/* Holographic light sheen corner highlight */}
      <div
        className="absolute top-0 right-0 w-44 h-44 rounded-tr-2xl pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(circle at top right, rgba(16, 185, 129, 0.25), transparent 70%)',
        }}
      />

      {/* MATCH stamp indicator (Jade) */}
      <div
        data-testid="stamp-match"
        className="absolute top-6 left-6 z-20 pointer-events-none px-3.5 py-1 rounded-lg border-2 border-jade bg-obsidian/80 text-jade font-black tracking-widest text-lg uppercase shadow-jade-glow transform -rotate-12 transition-opacity"
        style={{
          opacity: matchOpacity,
          willChange: 'opacity, transform',
        }}
      >
        MATCH
      </div>

      {/* PASS stamp indicator (Rose) */}
      <div
        data-testid="stamp-pass"
        className="absolute top-6 right-6 z-20 pointer-events-none px-3.5 py-1 rounded-lg border-2 border-rose bg-obsidian/80 text-rose font-black tracking-widest text-lg uppercase shadow-rose-glow transform rotate-12 transition-opacity"
        style={{
          opacity: passOpacity,
          willChange: 'opacity, transform',
        }}
      >
        PASS
      </div>

      {/* Card Header: Code Badge & Category */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <span
          data-testid="idea-code-badge"
          className="font-mono-tabular text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-950/90 text-emerald-400 border border-emerald-800/60 tracking-wide"
        >
          {idea.code || 'IDEA'}
        </span>

        <div className="flex items-center gap-1.5 text-xs text-mint/80 bg-surface/90 px-2.5 py-1 rounded-full border border-emerald-900/40">
          <Tag className="w-3 h-3 text-jade" />
          <span>{idea.category || 'General'}</span>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-xl sm:text-2xl font-bold text-mint-ivory tracking-tight mb-3 line-clamp-2">
        {idea.title}
      </h3>

      {/* One-Liner */}
      <p className="text-sm sm:text-base text-mint/90 leading-relaxed font-normal mb-5">
        {idea.oneLiner}
      </p>

      {/* Problem Statement if available */}
      {idea.problemStatement && (
        <div className="mb-3.5 p-3 rounded-xl bg-obsidian/60 border border-emerald-900/30 text-xs text-mint/75 leading-relaxed">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-400 mb-1">
            <Lightbulb className="w-3.5 h-3.5 text-jade" />
            <span>Problem</span>
          </div>
          <p>{idea.problemStatement}</p>
        </div>
      )}

      {/* Target Audience if available */}
      {idea.targetAudience && (
        <div className="mb-4 p-3 rounded-xl bg-obsidian/60 border border-emerald-900/30 text-xs text-mint/75 leading-relaxed">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-400 mb-1">
            <Target className="w-3.5 h-3.5 text-cyan-accent" />
            <span>Target Audience</span>
          </div>
          <p>{idea.targetAudience}</p>
        </div>
      )}

      {/* Accessible Action Buttons */}
      {showActions && isTopCard && (
        <div className="mt-6 pt-4 border-t border-emerald-900/40 flex items-center justify-between gap-4">
          <button
            type="button"
            data-testid="swipe-pass-button"
            aria-label={`Pass on ${idea.title}`}
            disabled={disabled || isAnimating}
            onClick={(e) => {
              e.stopPropagation();
              triggerSwipe('pass');
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose/30 bg-rose/10 hover:bg-rose/20 text-rose font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-rose/40 disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <X className="w-4 h-4" />
            <span>Pass</span>
          </button>

          <button
            type="button"
            data-testid="swipe-like-button"
            aria-label={`Match with ${idea.title}`}
            disabled={disabled || isAnimating}
            onClick={(e) => {
              e.stopPropagation();
              triggerSwipe('like');
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-jade/40 bg-jade/15 hover:bg-jade/25 text-jade font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-jade/50 shadow-jade-glow disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Match</span>
          </button>
        </div>
      )}
    </div>
  );
};
