import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { calculateSwipeDecision, useSwipeGesture } from '../src/hooks/useSwipeGesture';
import { SwipeCard } from '../src/components/SwipeCard';
import { SwipeDeck } from '../src/components/SwipeDeck';
import {
  recordSwipe,
  getRoomSwipes,
  createRoom,
  syncGoogleDoc,
  getRoomIdeas,
  resetMockRoomStoreForTesting,
} from '../src/services/roomService';
import { Idea } from '../src/types';

describe('calculateSwipeDecision', () => {
  it('returns like when dragged past right threshold', () => {
    expect(calculateSwipeDecision(150, 0, 100)).toBe('like');
  });

  it('returns pass when dragged past left threshold', () => {
    expect(calculateSwipeDecision(-150, 0, 100)).toBe('pass');
  });

  it('returns null when within threshold', () => {
    expect(calculateSwipeDecision(40, 0, 100)).toBeNull();
  });

  it('uses 100 as default threshold when omitted', () => {
    expect(calculateSwipeDecision(105, 0)).toBe('like');
    expect(calculateSwipeDecision(-105, 0)).toBe('pass');
    expect(calculateSwipeDecision(95, 0)).toBeNull();
    expect(calculateSwipeDecision(-95, 0)).toBeNull();
  });

  it('respects custom threshold parameter', () => {
    expect(calculateSwipeDecision(55, 0, 50)).toBe('like');
    expect(calculateSwipeDecision(-55, 0, 50)).toBe('pass');
    expect(calculateSwipeDecision(45, 0, 50)).toBeNull();
  });
});

describe('useSwipeGesture Hook', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with default zeroed state', () => {
    const { result } = renderHook(() => useSwipeGesture());

    expect(result.current.dx).toBe(0);
    expect(result.current.dy).toBe(0);
    expect(result.current.isDragging).toBe(false);
    expect(result.current.isAnimating).toBe(false);
    expect(result.current.rotation).toBe(0);
    expect(result.current.decision).toBeNull();
    expect(result.current.glowIntensity).toBe(0);
    expect(result.current.glowColor).toBeNull();
  });

  it('updates drag offset and computes rotation and glow on pointer move', () => {
    const { result } = renderHook(() => useSwipeGesture({ threshold: 100, maxRotation: 15 }));

    act(() => {
      result.current.bind.onPointerDown({
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        currentTarget: { setPointerCapture: vi.fn() },
      } as any);
    });

    expect(result.current.isDragging).toBe(true);

    act(() => {
      result.current.bind.onPointerMove({
        pointerId: 1,
        clientX: 180, // +80px drag
        clientY: 110,
      } as any);
    });

    expect(result.current.dx).toBe(80);
    expect(result.current.dy).toBe(10);
    expect(result.current.glowColor).toBe('jade');
    expect(result.current.glowIntensity).toBe(0.8);
    expect(result.current.rotation).toBeGreaterThan(0);
  });

  it('springs back to center if released below threshold', () => {
    const onSwipe = vi.fn();
    const { result } = renderHook(() => useSwipeGesture({ threshold: 100, onSwipe }));

    act(() => {
      result.current.bind.onPointerDown({
        pointerId: 1,
        clientX: 50,
        clientY: 50,
        currentTarget: { setPointerCapture: vi.fn() },
      } as any);
    });

    act(() => {
      result.current.bind.onPointerMove({
        pointerId: 1,
        clientX: 80, // +30px (below 100px threshold)
        clientY: 50,
      } as any);
    });

    act(() => {
      result.current.bind.onPointerUp({
        pointerId: 1,
        currentTarget: { hasPointerCapture: () => true, releasePointerCapture: vi.fn() },
      } as any);
    });

    expect(result.current.dx).toBe(0);
    expect(result.current.dy).toBe(0);
    expect(result.current.isDragging).toBe(false);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('triggers programmatic swipe for accessible button clicks', async () => {
    vi.useFakeTimers();
    const onSwipe = vi.fn();
    const { result } = renderHook(() => useSwipeGesture({ threshold: 100, onSwipe }));

    act(() => {
      result.current.triggerSwipe('like');
    });

    expect(result.current.isAnimating).toBe(true);
    expect(result.current.dx).toBeGreaterThan(500);

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(onSwipe).toHaveBeenCalledWith('like');
  });
});

describe('SwipeCard Component', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const mockIdea: Idea = {
    id: 'idea_1',
    code: 'I-042',
    title: 'Holographic Neural Curation',
    oneLiner: 'Tinder for ideas with real-time consensus metrics and instant daily sync.',
    problemStatement: 'Teams waste hours debating unranked feature backlogs.',
    targetAudience: 'Product teams & hackathon organizers',
    category: 'Productivity',
    status: 'active',
    likesCount: 5,
    passesCount: 2,
    score: 0.71,
  };

  it('renders idea code badge, category, title, one-liner, and problems', () => {
    render(
      React.createElement(SwipeCard, {
        idea: mockIdea,
        isTopCard: true,
      })
    );

    expect(screen.getByTestId('idea-code-badge').textContent).toContain('I-042');
    expect(screen.getByText('Productivity')).toBeDefined();
    expect(screen.getByText('Holographic Neural Curation')).toBeDefined();
    expect(
      screen.getByText('Tinder for ideas with real-time consensus metrics and instant daily sync.')
    ).toBeDefined();
    expect(screen.getByText('Teams waste hours debating unranked feature backlogs.')).toBeDefined();
    expect(screen.getByText('Product teams & hackathon organizers')).toBeDefined();
  });

  it('renders MATCH and PASS stamps with initial zero opacity', () => {
    render(
      React.createElement(SwipeCard, {
        idea: mockIdea,
        isTopCard: true,
      })
    );

    const matchStamp = screen.getByTestId('stamp-match');
    const passStamp = screen.getByTestId('stamp-pass');

    expect(matchStamp.textContent).toContain('MATCH');
    expect(passStamp.textContent).toContain('PASS');
    expect(matchStamp.style.opacity).toBe('0');
    expect(passStamp.style.opacity).toBe('0');
  });

  it('renders accessible Pass and Match action buttons on top card', () => {
    render(
      React.createElement(SwipeCard, {
        idea: mockIdea,
        isTopCard: true,
      })
    );

    const passBtn = screen.getByTestId('swipe-pass-button');
    const matchBtn = screen.getByTestId('swipe-like-button');

    expect(passBtn).toBeDefined();
    expect(matchBtn).toBeDefined();
    expect(passBtn.getAttribute('aria-label')).toBe(`Pass on ${mockIdea.title}`);
    expect(matchBtn.getAttribute('aria-label')).toBe(`Match with ${mockIdea.title}`);
  });

  it('triggers onSwipe with "like" when Match button is clicked', async () => {
    const onSwipe = vi.fn();
    render(
      React.createElement(SwipeCard, {
        idea: mockIdea,
        isTopCard: true,
        onSwipe,
      })
    );

    const matchBtn = screen.getByTestId('swipe-like-button');
    fireEvent.click(matchBtn);

    await waitFor(() => {
      expect(onSwipe).toHaveBeenCalledWith('like');
    }, { timeout: 3000 });
  });

  it('triggers onSwipe with "pass" when Pass button is clicked', async () => {
    const onSwipe = vi.fn();
    render(
      React.createElement(SwipeCard, {
        idea: mockIdea,
        isTopCard: true,
        onSwipe,
      })
    );

    const passBtn = screen.getByTestId('swipe-pass-button');
    fireEvent.click(passBtn);

    await waitFor(() => {
      expect(onSwipe).toHaveBeenCalledWith('pass');
    }, { timeout: 3000 });
  });

  it('handles keyboard navigation with arrow keys for accessibility', async () => {
    const onSwipe = vi.fn();
    render(
      React.createElement(SwipeCard, {
        idea: mockIdea,
        isTopCard: true,
        onSwipe,
      })
    );

    // Press ArrowRight for like
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(onSwipe).toHaveBeenCalledWith('like');
    }, { timeout: 3000 });

    onSwipe.mockClear();

    // Press ArrowLeft for pass
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(onSwipe).toHaveBeenCalledWith('pass');
    }, { timeout: 3000 });
  });
});

describe('SwipeDeck Component', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const sampleIdeas: Idea[] = [
    {
      id: 'idea_1',
      code: 'I-001',
      title: 'First Idea',
      oneLiner: 'Crisp summary one.',
      category: 'Design',
      status: 'active',
      likesCount: 0,
      passesCount: 0,
      score: 0,
    },
    {
      id: 'idea_2',
      code: 'I-002',
      title: 'Second Idea',
      oneLiner: 'Crisp summary two.',
      category: 'Tech',
      status: 'active',
      likesCount: 0,
      passesCount: 0,
      score: 0,
    },
    {
      id: 'idea_3',
      code: 'I-003',
      title: 'Third Idea',
      oneLiner: 'Crisp summary three.',
      category: 'Growth',
      status: 'active',
      likesCount: 0,
      passesCount: 0,
      score: 0,
    },
  ];

  it('renders empty state when ideas array is empty', () => {
    render(
      React.createElement(SwipeDeck, {
        ideas: [],
      })
    );

    expect(screen.getByTestId('swipe-deck-empty')).toBeDefined();
    expect(screen.getByText('No Active Ideas')).toBeDefined();
  });

  it('renders counter badge with "Card 1 of 3" in monospace tabular numbers', () => {
    render(
      React.createElement(SwipeDeck, {
        ideas: sampleIdeas,
      })
    );

    const counter = screen.getByTestId('swipe-counter-badge');
    expect(counter.textContent).toContain('Card1of3');
    expect(screen.getByText('First Idea')).toBeDefined();
  });

  it('advances to next card and updates counter when a card is swiped', async () => {
    const onSwipe = vi.fn();
    render(
      React.createElement(SwipeDeck, {
        ideas: sampleIdeas,
        onSwipe,
      })
    );

    expect(screen.getByText('First Idea')).toBeDefined();

    // Swipe first card like
    const matchBtn = screen.getByTestId('swipe-like-button');
    fireEvent.click(matchBtn);

    await waitFor(() => {
      expect(onSwipe).toHaveBeenCalledWith('idea_1', 'like');
      expect(screen.getByTestId('swipe-counter-badge').textContent).toContain('Card2of3');
      expect(screen.getByText('Second Idea')).toBeDefined();
    }, { timeout: 3000 });
  });

  it('shows completion screen and invokes onFinish after all cards are rated', async () => {
    const onSwipe = vi.fn();
    const onFinish = vi.fn();
    render(
      React.createElement(SwipeDeck, {
        ideas: sampleIdeas.slice(0, 2),
        onSwipe,
        onFinish,
      })
    );

    // Swipe card 1
    fireEvent.click(screen.getByTestId('swipe-like-button'));
    await waitFor(() => {
      expect(onSwipe).toHaveBeenCalledWith('idea_1', 'like');
      expect(screen.getByTestId('swipe-counter-badge').textContent).toContain('Card2of2');
    }, { timeout: 3000 });

    // Swipe card 2
    fireEvent.click(screen.getByTestId('swipe-pass-button'));
    await waitFor(() => {
      expect(onSwipe).toHaveBeenCalledWith('idea_2', 'pass');
      expect(onFinish).toHaveBeenCalled();
      expect(screen.getByTestId('swipe-deck-completion')).toBeDefined();
      expect(screen.getByText("You're All Caught Up!")).toBeDefined();
    }, { timeout: 3000 });

    // Click finish leaderboard button
    const finishBtn = screen.getByTestId('swipe-deck-finish-button');
    fireEvent.click(finishBtn);
    expect(onFinish).toHaveBeenCalledTimes(2);
  });
});

describe('recordSwipe Helper (Offline / Mock Fallback)', () => {
  beforeEach(() => {
    resetMockRoomStoreForTesting();
  });

  it('records like swipe and updates idea likesCount and score', async () => {
    const room = await createRoom('host_1', 'Test Room');
    const docContent = `### ★ I-100 Quantum Computing
- Status: pot
- One-liner: Practical quantum algorithms for optimization.
- Category: Science
`;
    await syncGoogleDoc(room.id, '', docContent);
    const ideas = await getRoomIdeas(room.id);
    const ideaId = ideas[0].id;

    const swipe = await recordSwipe(room.id, 'user_alice', ideaId, 'like');

    expect(swipe.userId).toBe('user_alice');
    expect(swipe.ideaId).toBe(ideaId);
    expect(swipe.vote).toBe('like');

    const updatedIdeas = await getRoomIdeas(room.id);
    expect(updatedIdeas[0].likesCount).toBe(1);
    expect(updatedIdeas[0].passesCount).toBe(0);
    expect(updatedIdeas[0].score).toBe(1.0);

    const userSwipes = await getRoomSwipes(room.id, 'user_alice');
    expect(userSwipes).toHaveLength(1);
    expect(userSwipes[0].vote).toBe('like');
  });

  it('records pass swipe and updates passesCount and score', async () => {
    const room = await createRoom('host_1', 'Test Room');
    const docContent = `### ★ I-101 Nuclear Fusion
- Status: pot
- One-liner: Micro reactors for household power.
- Category: Energy
`;
    await syncGoogleDoc(room.id, '', docContent);
    const ideas = await getRoomIdeas(room.id);
    const ideaId = ideas[0].id;

    // Alice likes, Bob passes
    await recordSwipe(room.id, 'user_alice', ideaId, 'like');
    await recordSwipe(room.id, 'user_bob', ideaId, 'pass');

    const updatedIdeas = await getRoomIdeas(room.id);
    expect(updatedIdeas[0].likesCount).toBe(1);
    expect(updatedIdeas[0].passesCount).toBe(1);
    expect(updatedIdeas[0].score).toBe(0.5); // 1 / 2

    const allSwipes = await getRoomSwipes(room.id);
    expect(allSwipes).toHaveLength(2);
  });

  it('SwipeDeck automatically calls recordSwipe when roomId and userId are provided', async () => {
    const room = await createRoom('host_1', 'Test Room');
    const docContent = `### ★ I-102 Autonomous Drone
- Status: pot
- One-liner: Solar powered delivery drones.
- Category: Robotics
`;
    await syncGoogleDoc(room.id, '', docContent);
    const ideas = await getRoomIdeas(room.id);

    render(
      React.createElement(SwipeDeck, {
        ideas,
        roomId: room.id,
        userId: 'user_charlie',
      })
    );

    fireEvent.click(screen.getByTestId('swipe-like-button'));

    await waitFor(async () => {
      const swipes = await getRoomSwipes(room.id, 'user_charlie');
      expect(swipes).toHaveLength(1);
      expect(swipes[0].vote).toBe('like');
    }, { timeout: 3000 });
  });
});
