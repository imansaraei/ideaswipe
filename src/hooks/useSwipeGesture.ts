import { useState, useRef, useCallback, useEffect } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

export type SwipeDirection = 'like' | 'pass';

/**
 * Calculates whether the current gesture has passed the like or pass threshold.
 * deltaX > 0 represents a right-swipe (like).
 * deltaX < 0 represents a left-swipe (pass).
 */
export function calculateSwipeDecision(
  deltaX: number,
  _deltaY: number = 0,
  threshold: number = 100
): SwipeDirection | null {
  const effectiveThreshold = Math.abs(threshold) || 100;
  if (deltaX >= effectiveThreshold) {
    return 'like';
  }
  if (deltaX <= -effectiveThreshold) {
    return 'pass';
  }
  return null;
}

export interface UseSwipeGestureOptions {
  threshold?: number;
  maxRotation?: number;
  disabled?: boolean;
  onSwipe?: (direction: SwipeDirection) => void;
}

export interface SwipeGestureState {
  dx: number;
  dy: number;
  isDragging: boolean;
  isAnimating: boolean;
  rotation: number;
  decision: SwipeDirection | null;
  glowIntensity: number;
  glowColor: 'jade' | 'rose' | null;
  triggerSwipe: (direction: SwipeDirection) => Promise<void>;
  resetPosition: () => void;
  bind: {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  };
  style: CSSProperties;
}

/**
 * Hook for 60fps hardware-accelerated pointer swipe gestures on cards.
 */
export function useSwipeGesture(options: UseSwipeGestureOptions = {}): SwipeGestureState {
  const {
    threshold = 100,
    maxRotation = 15,
    disabled = false,
    onSwipe,
  } = options;

  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const resetPosition = useCallback(() => {
    setDx(0);
    setDy(0);
    setIsDragging(false);
    setIsAnimating(false);
    startPointRef.current = null;
    activePointerIdRef.current = null;
  }, []);

  const triggerSwipe = useCallback(
    async (direction: SwipeDirection): Promise<void> => {
      if (disabled || isAnimating) return;

      setIsAnimating(true);
      const targetDx = direction === 'like' ? 650 : -650;
      setDx(targetDx);
      setDy(0);

      await new Promise((resolve) => setTimeout(resolve, 220));

      if (isMountedRef.current) {
        onSwipe?.(direction);
        resetPosition();
      }
    },
    [disabled, isAnimating, onSwipe, resetPosition]
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (disabled || isAnimating || (e.button !== undefined && e.button !== 0)) {
        return;
      }

      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // Safe fallback if pointer capture fails in test or restricted environments
      }

      activePointerIdRef.current = e.pointerId;
      startPointRef.current = { x: e.clientX, y: e.clientY };
      setIsDragging(true);
    },
    [disabled, isAnimating]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!isDragging || !startPointRef.current) return;
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
        return;
      }

      const currentDx = e.clientX - startPointRef.current.x;
      const currentDy = e.clientY - startPointRef.current.y;

      setDx(currentDx);
      setDy(currentDy);
    },
    [isDragging]
  );

  const onPointerEnd = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!isDragging) return;

      try {
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
          e.currentTarget.releasePointerCapture?.(e.pointerId);
        }
      } catch {
        // Safe fallback
      }

      setIsDragging(false);
      activePointerIdRef.current = null;

      const decision = calculateSwipeDecision(dx, dy, threshold);

      if (decision) {
        // Flyout animation past screen boundary
        setIsAnimating(true);
        const flyoutDx = decision === 'like' ? 700 : -700;
        setDx(flyoutDx);

        setTimeout(() => {
          if (isMountedRef.current) {
            onSwipe?.(decision);
            resetPosition();
          }
        }, 200);
      } else {
        // Spring return to center
        setDx(0);
        setDy(0);
        startPointRef.current = null;
      }
    },
    [isDragging, dx, dy, threshold, onSwipe, resetPosition]
  );

  // Compute rotation proportional to horizontal drag distance
  const rotation = Math.max(-maxRotation, Math.min(maxRotation, (dx / (threshold * 1.5)) * maxRotation));

  // Intensity from 0 to 1 based on distance to threshold
  const glowIntensity = Math.min(1, Math.max(0, Math.abs(dx) / threshold));
  const glowColor: 'jade' | 'rose' | null = dx > 0 ? 'jade' : dx < 0 ? 'rose' : null;
  const decision = calculateSwipeDecision(dx, dy, threshold);

  const style: CSSProperties = {
    transform: `translate3d(${dx}px, ${dy}px, 0) rotate(${rotation}deg)`,
    transition: isDragging ? 'none' : 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
    willChange: 'transform',
    touchAction: 'none',
    userSelect: 'none',
  };

  return {
    dx,
    dy,
    isDragging,
    isAnimating,
    rotation,
    decision,
    glowIntensity,
    glowColor,
    triggerSwipe,
    resetPosition,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
    style,
  };
}
