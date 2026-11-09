import React, { useState, useCallback } from 'react';
import { Idea } from '../types';
import { SwipeDirection } from '../hooks/useSwipeGesture';
import { SwipeCard } from './SwipeCard';
import { recordSwipe } from '../services/roomService';
import { CheckCircle2, Sparkles, ArrowRight, Layers } from 'lucide-react';

export { recordSwipe };

export interface SwipeDeckProps {
  ideas: Idea[];
  onSwipe?: (ideaId: string, direction: SwipeDirection) => void | Promise<void>;
  onFinish?: () => void;
  roomId?: string;
  userId?: string;
  className?: string;
}

/**
 * 60fps Stack of active idea cards with swipe gestures,
 * progress counter badge ("Card 1 of 3" with monospace tabular numbers),
 * and round completion screen.
 */
export const SwipeDeck: React.FC<SwipeDeckProps> = ({
  ideas = [],
  onSwipe,
  onFinish,
  roomId,
  userId,
  className = '',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const totalCards = ideas.length;
  const isFinished = totalCards > 0 && currentIndex >= totalCards;
  const isEmpty = totalCards === 0;

  const handleCardSwipe = useCallback(
    async (ideaId: string, direction: SwipeDirection) => {
      // If roomId and userId are provided, record to backend store
      if (roomId && userId) {
        try {
          await recordSwipe(roomId, userId, ideaId, direction);
        } catch (err) {
          console.warn('[SwipeDeck] Failed to record vote:', err);
        }
      }

      // Notify parent listener
      await onSwipe?.(ideaId, direction);

      setCurrentIndex((prev) => {
        const nextIndex = prev + 1;
        if (nextIndex >= totalCards) {
          onFinish?.();
        }
        return nextIndex;
      });
    },
    [roomId, userId, onSwipe, totalCards, onFinish]
  );

  // Empty state
  if (isEmpty) {
    return (
      <div
        data-testid="swipe-deck-empty"
        className={`flex flex-col items-center justify-center p-8 rounded-2xl border border-emerald-900/40 bg-surface text-center max-w-md mx-auto ${className}`}
      >
        <div className="w-12 h-12 rounded-full bg-emerald-950 flex items-center justify-center text-emerald-400 mb-4 border border-emerald-800/40">
          <Layers className="w-6 h-6 text-jade" />
        </div>
        <h3 className="text-lg font-bold text-mint-ivory mb-2">No Active Ideas</h3>
        <p className="text-sm text-mint/70 max-w-xs">
          There are no cards in the current round. Check back when the host triggers the next shuffle!
        </p>
      </div>
    );
  }

  // Round completion state
  if (isFinished) {
    return (
      <div
        data-testid="swipe-deck-completion"
        className={`flex flex-col items-center justify-center p-8 rounded-2xl border border-jade/40 bg-gradient-to-b from-[#0c2018] to-[#040e0a] text-center max-w-md mx-auto shadow-jade-glow ${className}`}
      >
        <div className="w-16 h-16 rounded-full bg-emerald-950 flex items-center justify-center text-jade mb-4 border border-emerald-800/60 shadow-jade-glow">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-jade/10 text-jade text-xs font-semibold uppercase tracking-wider mb-2 border border-jade/30">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Round Complete</span>
        </div>
        <h3 className="text-2xl font-black text-mint-ivory tracking-tight mb-2">
          You're All Caught Up!
        </h3>
        <p className="text-sm text-mint/80 mb-6 leading-relaxed max-w-xs">
          You voted on all <span className="font-mono-tabular font-bold text-mint-ivory">{totalCards}</span> ideas in this round. See how they stack up on the King of the Hill leaderboard!
        </p>

        {onFinish && (
          <button
            type="button"
            data-testid="swipe-deck-finish-button"
            onClick={onFinish}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-jade hover:bg-emerald-400 text-obsidian font-bold text-sm tracking-wide shadow-jade-glow transition-all active:scale-98 cursor-pointer"
          >
            <span>View Leaderboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  // Active stack slice: show top card plus up to 2 background preview cards
  const visibleCards = ideas.slice(currentIndex, currentIndex + 3);
  const currentCardNumber = currentIndex + 1;
  const progressPercent = Math.min(100, Math.round((currentIndex / totalCards) * 100));

  return (
    <div
      data-testid="swipe-deck"
      className={`w-full max-w-md mx-auto flex flex-col items-center ${className}`}
    >
      {/* Top Bar: Progress and Monospace Counter Badge */}
      <div className="w-full flex items-center justify-between mb-4 px-2">
        <div
          data-testid="swipe-counter-badge"
          className="inline-flex items-center gap-1 text-xs text-mint/80 bg-surface/90 px-3 py-1.5 rounded-full border border-emerald-900/40"
        >
          <span>Card</span>
          <span className="font-mono-tabular font-bold text-mint-ivory">{currentCardNumber}</span>
          <span className="text-mint/50">of</span>
          <span className="font-mono-tabular font-bold text-mint-ivory">{totalCards}</span>
        </div>

        {/* Mini progress percentage */}
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 rounded-full bg-obsidian border border-emerald-950 overflow-hidden">
            <div
              className="h-full bg-jade transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="font-mono-tabular text-xs text-mint/60">{progressPercent}%</span>
        </div>
      </div>

      {/* Card Stacking Container */}
      <div className="relative w-full min-h-[460px] flex items-center justify-center">
        {/* Render visible cards in reverse so top card mounts last and has highest natural z-index */}
        {visibleCards
          .map((idea, indexInSlice) => {
            const isTop = indexInSlice === 0;
            const stackDepth = indexInSlice; // 0 = top, 1 = mid, 2 = bottom

            let stackStyle: React.CSSProperties = {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
            };

            if (!isTop) {
              const scale = 1 - stackDepth * 0.04;
              const translateY = stackDepth * 12;
              const opacity = 1 - stackDepth * 0.25;

              stackStyle = {
                ...stackStyle,
                transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
                opacity,
                zIndex: 10 - stackDepth,
                pointerEvents: 'none',
              };
            } else {
              stackStyle = {
                ...stackStyle,
                zIndex: 20,
              };
            }

            return (
              <SwipeCard
                key={idea.id}
                idea={idea}
                isTopCard={isTop}
                onSwipe={(direction) => handleCardSwipe(idea.id, direction)}
                style={stackStyle}
              />
            );
          })
          .reverse()}
      </div>
    </div>
  );
};
