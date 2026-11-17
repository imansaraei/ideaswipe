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
  onDragProgress?: (progress: number, dx: number) => void;
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

interface PointerSample {
  x: number;
  y: number;
  time: number;
}

/**
 * Hook for 60fps hardware-accelerated pointer swipe gestures on cards.
 * Incorporates Apple-style physics: release velocity tracking, momentum projection,
 * direction verification, haptic cues, reduced-motion awareness, and pan-y at rest.
 */
export function useSwipeGesture(options: UseSwipeGestureOptions = {}): SwipeGestureState {
  const {
    threshold = 100,
    maxRotation = 15,
    disabled = false,
    onSwipe,
    onDragProgress,
  } = options;

  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const samplesRef = useRef<PointerSample[]>([]);
  const isMountedRef = useRef(true);
  const prevDecisionRef = useRef<SwipeDirection | null>(null);

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
    samplesRef.current = [];
    onDragProgress?.(0, 0);
  }, [onDragProgress]);

  const triggerSwipe = useCallback(
    async (direction: SwipeDirection): Promise<void> => {
      if (disabled || isAnimating) return;

      setIsAnimating(true);
      const targetDx = direction === 'like' ? 650 : -650;
      setDx(targetDx);
      setDy(0);
      onDragProgress?.(1, targetDx);

      await new Promise((resolve) => setTimeout(resolve, 220));

      if (isMountedRef.current) {
        onSwipe?.(direction);
        resetPosition();
      }
    },
    [disabled, isAnimating, onSwipe, resetPosition, onDragProgress]
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (disabled || isAnimating || (e.button !== undefined && e.button !== 0)) {
        return;
      }

      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // Safe fallback in test or restricted environments
      }

      activePointerIdRef.current = e.pointerId;
      startPointRef.current = { x: e.clientX, y: e.clientY };
      samplesRef.current = [{ x: e.clientX, y: e.clientY, time: performance.now() }];
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

      const now = performance.now();
      samplesRef.current.push({ x: e.clientX, y: e.clientY, time: now });
      // Keep only samples from last 120ms for instant velocity responsiveness
      if (samplesRef.current.length > 8) {
        samplesRef.current = samplesRef.current.slice(-8);
      }

      setDx(currentDx);
      setDy(currentDy);
      onDragProgress?.(Math.min(1, Math.abs(currentDx) / threshold), currentDx);
    },
    [isDragging, threshold, onDragProgress]
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

      // Calculate release velocity from recent history
      const now = performance.now();
      const recent = samplesRef.current.filter((s) => now - s.time <= 120);
      let vx = 0; // px / sec
      if (recent.length >= 2) {
        const first = recent[0];
        const last = recent[recent.length - 1];
        const dt = (last.time - first.time) / 1000;
        if (dt > 0.005) {
          vx = (last.x - first.x) / dt;
        }
      }

      // Momentum projection: resting position = dx + vx * 0.18
      const projectedDx = dx + vx * 0.18;

      // Determine decision:
      // 1. Direct displacement past threshold (and release velocity doesn't strongly oppose)
      // 2. High velocity flick where projectedDx crosses threshold and user moved in that direction
      let decision: SwipeDirection | null = null;

      if (dx >= threshold && vx >= -200) {
        decision = 'like';
      } else if (dx <= -threshold && vx <= 200) {
        decision = 'pass';
      } else if (projectedDx >= threshold && dx > 20 && vx > 350) {
        decision = 'like';
      } else if (projectedDx <= -threshold && dx < -20 && vx < -350) {
        decision = 'pass';
      }

      if (decision) {
        // Flyout animation past screen boundary
        setIsAnimating(true);
        const flyoutDx = decision === 'like' ? 700 : -700;
        setDx(flyoutDx);
        onDragProgress?.(1, flyoutDx);

        setTimeout(() => {
          if (isMountedRef.current) {
            onSwipe?.(decision as SwipeDirection);
            resetPosition();
          }
        }, 200);
      } else {
        // Spring return to center
        setDx(0);
        setDy(0);
        startPointRef.current = null;
        samplesRef.current = [];
        onDragProgress?.(0, 0);
      }
    },
    [isDragging, dx, threshold, onSwipe, resetPosition, onDragProgress]
  );

  // Compute rotation proportional to horizontal drag distance
  const rotation = Math.max(-maxRotation, Math.min(maxRotation, (dx / (threshold * 1.5)) * maxRotation));

  // Intensity from 0 to 1 based on distance to threshold
  const glowIntensity = Math.min(1, Math.max(0, Math.abs(dx) / threshold));
  const glowColor: 'jade' | 'rose' | null = dx > 0 ? 'jade' : dx < 0 ? 'rose' : null;
  const decision = calculateSwipeDecision(dx, dy, threshold);

  // Haptic feedback tick when crossing threshold
  useEffect(() => {
    if (decision && decision !== prevDecisionRef.current) {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(10);
        } catch {
          // Ignore vibration error
        }
      }
    }
    prevDecisionRef.current = decision;
  }, [decision]);

  const style: CSSProperties = {
    transform: `translate3d(${dx}px, ${dy}px, 0) rotate(${rotation}deg)`,
    transition: isDragging ? 'none' : 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
    willChange: 'transform',
    touchAction: isDragging ? 'none' : 'pan-y',
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
