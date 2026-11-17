import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Idea } from '../types';
import { SwipeDirection } from '../hooks/useSwipeGesture';
import { SwipeCard } from './SwipeCard';
import { recordSwipe, removeSwipe } from '../services/roomService';
import { CheckCircle2, Sparkles, ArrowRight, Layers, RotateCcw } from 'lucide-react';

export { recordSwipe };

export interface SwipeDeckProps {
  ideas: Idea[];
  swipedIdeaIds?: Set<string> | string[];
  onSwipe?: (ideaId: string, direction: SwipeDirection) => void | Promise<void>;
  onFinish?: () => void;
  roomId?: string;
  userId?: string;
  isHost?: boolean;
  onAddIdeas?: () => void;
  className?: string;
}

/**
 * 60fps Stack of active idea cards with fluid Apple-style interaction physics,
 * continuous background layer depth interpolation, progress counter badge,
 * undo support, and round completion screen.
 */
export const SwipeDeck: React.FC<SwipeDeckProps> = ({
  ideas = [],
  swipedIdeaIds,
  onSwipe,
  onFinish,
  roomId,
  userId,
  isHost = false,
  onAddIdeas,
  className = '',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [topCardProgress, setTopCardProgress] = useState(0);
  const [swipeHistory, setSwipeHistory] = useState<{ ideaId: string; direction: SwipeDirection }[]>([]);

  const swipedSet = useMemo(() => {
    if (!swipedIdeaIds) return null;
    return swipedIdeaIds instanceof Set ? swipedIdeaIds : new Set(swipedIdeaIds);
  }, [swipedIdeaIds]);

  // Snapshot initial swiped set so reactive background swipe updates do not double-advance currentIndex
  const initialSwipedSnapshot = useRef<Set<string> | null>(null);
  // Order-independent key: vote counts can re-rank the batch mid-round, which must not reset the deck.
  const ideasKey = useMemo(() => ideas.map((i) => i.id).sort().join(','), [ideas]);
  const roundOrder = useRef<{ key: string; ids: string[] } | null>(null);
  if (roundOrder.current?.key !== ideasKey) {
    roundOrder.current = { key: ideasKey, ids: ideas.map((i) => i.id) };
  }

  useEffect(() => {
    initialSwipedSnapshot.current = null;
    setCurrentIndex(0);
    setTopCardProgress(0);
    setSwipeHistory([]);
  }, [ideasKey]);

  if (initialSwipedSnapshot.current === null && swipedSet !== null) {
    initialSwipedSnapshot.current = new Set(swipedSet);
  }

  const effectiveIdeas = useMemo(() => {
    const filterSet = initialSwipedSnapshot.current;
    const byId = new Map(ideas.map((i) => [i.id, i]));
    const ordered = roundOrder.current!.ids.map((id) => byId.get(id)!).filter(Boolean);
    if (!filterSet || filterSet.size === 0) return ordered;
    return ordered.filter((idea) => !filterSet.has(idea.id));
  }, [ideas, ideasKey]);

  const isRoundAlreadyCompleted =
    ideas.length > 0 && swipedSet !== null && effectiveIdeas.length === 0;

  const totalCards = effectiveIdeas.length;
  const isFinished =
    (totalCards > 0 && currentIndex >= totalCards) || isRoundAlreadyCompleted;
  const isEmpty = totalCards === 0 && !isRoundAlreadyCompleted;

  const handleCardSwipe = useCallback(
    (ideaId: string, direction: SwipeDirection) => {
      setSwipeHistory((prev) => [...prev, { ideaId, direction }]);
      setTopCardProgress(0);

      // Optimistically advance card immediately so 60fps gesture transition is seamless
      setCurrentIndex((prev) => prev + 1);

      // Background write without blocking UI or animation
      if (roomId && userId) {
        recordSwipe(roomId, userId, ideaId, direction).catch((err) => {
          console.warn('[SwipeDeck] Failed to record vote:', err);
        });
      }

      // Notify parent listener asynchronously
      try {
        onSwipe?.(ideaId, direction);
      } catch (err) {
        console.warn('[SwipeDeck] onSwipe error:', err);
      }
    },
    [roomId, userId, onSwipe]
  );

  const handleUndo = useCallback(() => {
    if (currentIndex <= 0 || swipeHistory.length === 0) return;
    const last = swipeHistory[swipeHistory.length - 1];
    if (roomId && userId) {
      removeSwipe(roomId, userId, last.ideaId).catch((err) => {
        console.warn('[SwipeDeck] Failed to undo vote:', err);
      });
    }
    setSwipeHistory((prev) => prev.slice(0, -1));
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setTopCardProgress(0);
  }, [currentIndex, swipeHistory, roomId, userId]);

  // Linear/Raycast-style keyboard shortcut for Undo (Z or Backspace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if ((e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey) {
        if (currentIndex > 0 && swipeHistory.length > 0) {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, swipeHistory.length, handleUndo]);

  // Empty state
  if (isEmpty) {
    return (
      <div
        data-testid="swipe-deck-empty"
        className={`flex flex-col items-center justify-center p-8 rounded-2xl border border-jade/20 bg-surface text-center max-w-md mx-auto ${className}`}
      >
        <div className="w-12 h-12 rounded-full bg-well flex items-center justify-center text-jade mb-4 border border-jade/30 shadow-jade-glow">
          <Layers className="w-6 h-6 text-jade" />
        </div>
        <h3 className="text-lg font-bold text-mint-ivory mb-2">No Active Ideas</h3>
        <p className="text-sm text-mint/70 max-w-xs mb-4">
          There are no cards in the current round. Check back when the host triggers the next shuffle!
        </p>
        {(isHost || onAddIdeas) && (
          <button
            type="button"
            data-testid="swipe-deck-add-ideas"
            onClick={onAddIdeas}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-jade hover:bg-jade-focus text-obsidian font-bold text-xs tracking-wide shadow-jade-glow transition-all active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Add Ideas to Pot</span>
          </button>
        )}
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
        <div className="w-16 h-16 rounded-full bg-well flex items-center justify-center text-jade mb-4 border border-jade/40 shadow-jade-glow">
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
          You voted on all <span className="font-mono-tabular font-bold text-mint-ivory">{ideas.length}</span> ideas in this round. See how they stack up on the King of the Hill leaderboard!
        </p>

        <div className="w-full flex flex-col gap-2.5">
          {onFinish && (
            <button
              type="button"
              data-testid="swipe-deck-finish-button"
              onClick={onFinish}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-jade hover:bg-jade-focus text-obsidian font-bold text-sm tracking-wide shadow-jade-glow transition-all active:scale-95 cursor-pointer"
            >
              <span>View Leaderboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {swipeHistory.length > 0 && (
            <button
              type="button"
              onClick={handleUndo}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface hover:bg-well border border-jade/20 hover:border-jade/40 text-mint/80 hover:text-mint font-medium text-xs transition-all active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-jade" />
              <span>Undo Last Vote</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Active stack slice: show top card plus up to 2 background preview cards
  const visibleCards = effectiveIdeas.slice(currentIndex, currentIndex + 3);
  const currentCardNumber = currentIndex + 1;
  const progressPercent = Math.min(100, Math.round((currentIndex / totalCards) * 100));

  return (
    <div
      data-testid="swipe-deck"
      className={`w-full max-w-md mx-auto flex flex-col items-center ${className}`}
    >
      {/* Top Bar: Progress, Monospace Counter Badge, and Undo */}
      <div className="w-full flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <div
            data-testid="swipe-counter-badge"
            className="inline-flex items-center gap-1 text-xs text-mint/80 bg-surface/90 px-3 py-1.5 rounded-full border border-jade/20"
          >
            <span>Card</span>
            <span className="font-mono-tabular font-bold text-mint-ivory">{currentCardNumber}</span>
            <span className="text-mint/50">of</span>
            <span className="font-mono-tabular font-bold text-mint-ivory">{totalCards}</span>
          </div>

          {currentIndex > 0 && swipeHistory.length > 0 && (
            <button
              type="button"
              data-testid="swipe-undo-button"
              onClick={handleUndo}
              aria-label="Undo previous swipe"
              className="inline-flex items-center gap-1 text-xs text-mint/70 hover:text-jade bg-surface px-2.5 py-1.5 rounded-full border border-jade/20 hover:border-jade/40 transition-all active:scale-95 cursor-pointer"
              title="Undo last swipe"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
          )}
        </div>

        {/* Mini progress percentage */}
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 rounded-full bg-obsidian border border-jade/20 overflow-hidden">
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
              // Interpolate physical scaling & translation dynamically with top card drag
              const dragFactor = topCardProgress;
              const baseTranslateY = stackDepth * 12;
              const interpolatedTranslateY = baseTranslateY - dragFactor * 12;

              const baseScale = 1 - stackDepth * 0.04;
              const interpolatedScale = baseScale + dragFactor * 0.04;

              const baseOpacity = 1 - stackDepth * 0.25;
              const interpolatedOpacity = Math.min(1, baseOpacity + dragFactor * 0.25);

              stackStyle = {
                ...stackStyle,
                transform: `translate3d(0, ${interpolatedTranslateY}px, 0) scale(${interpolatedScale})`,
                opacity: interpolatedOpacity,
                zIndex: 10 - stackDepth,
                pointerEvents: 'none',
                transition: dragFactor === 0 ? 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease' : 'none',
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
                onDragProgress={isTop ? (progress) => setTopCardProgress(progress) : undefined}
                onSwipe={(direction) => handleCardSwipe(idea.id, direction)}
                style={stackStyle}
              />
            );
          })
          .reverse()}
      </div>

      {/* Linear/Raycast-style Keyboard Shortcut Hint Bar */}
      <div className="hidden sm:flex items-center justify-center gap-4 mt-4 text-[11px] text-mint/50">
        <span className="inline-flex items-center gap-1.5">
          <kbd className="kbd-cap">←</kbd>
          <span>Pass</span>
        </span>
        <span className="text-jade/30">·</span>
        <span className="inline-flex items-center gap-1.5">
          <kbd className="kbd-cap">→</kbd>
          <span>Match</span>
        </span>
        {currentIndex > 0 && swipeHistory.length > 0 && (
          <>
            <span className="text-jade/30">·</span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="kbd-cap">Z</kbd>
              <span>Undo</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
};
