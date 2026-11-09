import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { rankLeaderboardIdeas } from '../src/lib/leaderboard';
import { LeaderboardView, formatConsensusMetric } from '../src/components/LeaderboardView';
import { JoinRoomScreen, parseRoomCodeFromUrl } from '../src/components/JoinRoomScreen';
import { useRoomData } from '../src/hooks/useRoomData';
import {
  createRoom,
  syncGoogleDoc,
  resetMockRoomStoreForTesting,
  getRoomByCode,
} from '../src/services/roomService';
import { Idea, Room } from '../src/types';

describe('rankLeaderboardIdeas & formatConsensusMetric', () => {
  it('ranks ideas by like percentage and displays vote metrics', () => {
    const ideas = [
      { id: '1', title: 'Idea 1', likesCount: 3, passesCount: 1 }, // 75%
      { id: '2', title: 'Idea 2', likesCount: 4, passesCount: 0 }, // 100%
      { id: '3', title: 'Idea 3', likesCount: 1, passesCount: 3 }, // 25%
    ] as any;

    const ranked = rankLeaderboardIdeas(ideas, 2);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].id).toBe('2');
    expect(ranked[1].id).toBe('1');
  });

  it('formats consensus percentage and vote counts cleanly in tabular format', () => {
    expect(formatConsensusMetric(4, 0)).toBe('100% (4/4 Yes)');
    expect(formatConsensusMetric(3, 1)).toBe('75% (3/4 Yes)');
    expect(formatConsensusMetric(1, 3)).toBe('25% (1/4 Yes)');
    expect(formatConsensusMetric(0, 0)).toBe('0% (0/0 Yes)');
  });
});

describe('LeaderboardView Component', () => {
  const mockIdeas: Idea[] = [
    {
      id: 'idea-1',
      code: 'I-001',
      title: 'Decentralized Social Feed',
      oneLiner: 'Censorship resistant social microblogging.',
      category: 'Web3',
      status: 'active',
      likesCount: 6,
      passesCount: 0,
      score: 1,
    },
    {
      id: 'idea-2',
      code: 'I-002',
      title: 'AI Code Review Companion',
      oneLiner: 'Automatic linting and semantic suggestions.',
      category: 'DevTools',
      status: 'active',
      likesCount: 3,
      passesCount: 1,
      score: 0.75,
    },
    {
      id: 'idea-3',
      code: 'I-003',
      title: 'Smart Plant Waterer',
      oneLiner: 'Automated hydration for houseplants.',
      category: 'IoT',
      status: 'active',
      likesCount: 1,
      passesCount: 3,
      score: 0.25,
    },
    {
      id: 'idea-4',
      code: 'I-004',
      title: 'VR Yoga Studio',
      oneLiner: 'Immersive yoga sessions at home.',
      category: 'Fitness',
      status: 'active',
      likesCount: 0,
      passesCount: 2,
      score: 0,
    },
  ];

  const mockRoom: Room = {
    id: 'room-101',
    code: 'SWP402',
    name: 'Hackathon Top Picks',
    hostUserId: 'host-1',
    leaderboardLimit: 3,
    activeIdeaIds: ['idea-1', 'idea-2', 'idea-3'],
    createdAt: Date.now(),
  };

  it('renders top N champion ideas ranked by consensus percentage with crown badge for #1', () => {
    render(
      React.createElement(LeaderboardView, {
        roomId: 'room-101',
        limit: 3,
        initialRoom: mockRoom,
        initialIdeas: mockIdeas,
        participantCount: 6,
      })
    );

    // Header & Room Info
    expect(screen.getByText('Hackathon Top Picks')).toBeDefined();
    expect(screen.getByText(/King of the Hill/i)).toBeDefined();

    // Top 3 champions rendered, 4th omitted due to limit=3
    expect(screen.getByText('Decentralized Social Feed')).toBeDefined();
    expect(screen.getByText('AI Code Review Companion')).toBeDefined();
    expect(screen.getByText('Smart Plant Waterer')).toBeDefined();
    expect(screen.queryByText('VR Yoga Studio')).toBeNull();

    // Champion badge / rank indicators
    expect(screen.getByTestId('rank-badge-1')).toBeDefined();
    expect(screen.getByTestId('rank-badge-2')).toBeDefined();
    expect(screen.getByTestId('rank-badge-3')).toBeDefined();

    // Check consensus metrics in tabular monospace
    expect(screen.getByText('100% (6/6 Yes)')).toBeDefined();
    expect(screen.getByText('75% (3/4 Yes)')).toBeDefined();
    expect(screen.getByText('25% (1/4 Yes)')).toBeDefined();

    // Verify tabular monospace CSS class
    const metricElem = screen.getByText('100% (6/6 Yes)');
    expect(metricElem.className).toContain('font-mono-tabular');
  });

  it('renders animated jade progress bars with accurate width percentage', () => {
    render(
      React.createElement(LeaderboardView, {
        roomId: 'room-101',
        limit: 3,
        initialRoom: mockRoom,
        initialIdeas: mockIdeas,
      })
    );

    const progressBars = screen.getAllByTestId('consensus-progress-bar');
    expect(progressBars).toHaveLength(3);
    expect(progressBars[0].style.width).toBe('100%');
    expect(progressBars[1].style.width).toBe('75%');
    expect(progressBars[2].style.width).toBe('25%');
  });

  it('displays room member participation indicators', () => {
    render(
      React.createElement(LeaderboardView, {
        roomId: 'room-101',
        limit: 3,
        initialRoom: mockRoom,
        initialIdeas: mockIdeas,
        participantCount: 8,
        totalVotes: 14,
      })
    );

    expect(screen.getByText(/8 members/i)).toBeDefined();
    expect(screen.getByText(/14 votes/i)).toBeDefined();
  });

  it('displays empty state when no ideas are available', () => {
    render(
      React.createElement(LeaderboardView, {
        roomId: 'room-101',
        limit: 3,
        initialRoom: mockRoom,
        initialIdeas: [],
      })
    );

    expect(screen.getByText(/No ideas ranked yet/i)).toBeDefined();
  });
});

describe('parseRoomCodeFromUrl', () => {
  it('parses ?code= query param', () => {
    expect(parseRoomCodeFromUrl('https://ideaswipe.app/join?code=SWP402')).toBe('SWP402');
    expect(parseRoomCodeFromUrl('http://localhost:5173/?code=abc123')).toBe('ABC123');
  });

  it('parses direct invite links with /join/:code', () => {
    expect(parseRoomCodeFromUrl('https://ideaswipe.app/join/SWP402')).toBe('SWP402');
    expect(parseRoomCodeFromUrl('/join/XYZ789')).toBe('XYZ789');
  });

  it('returns empty string when no code is present', () => {
    expect(parseRoomCodeFromUrl('https://ideaswipe.app/')).toBe('');
    expect(parseRoomCodeFromUrl('')).toBe('');
  });
});

describe('JoinRoomScreen Component', () => {
  beforeEach(() => {
    resetMockRoomStoreForTesting();
  });

  it('renders input for 6-character room codes with tabular monospace uppercase styling', () => {
    render(React.createElement(JoinRoomScreen, { onJoinSuccess: vi.fn() }));

    const input = screen.getByPlaceholderText(/ROOM CODE/i) as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.className).toContain('font-mono-tabular');
    expect(input.className).toContain('tracking-widest');
    expect(input.className).toContain('uppercase');
  });

  it('normalizes input: converts to uppercase, removes special characters, and caps at 6 chars', () => {
    render(React.createElement(JoinRoomScreen, { onJoinSuccess: vi.fn() }));

    const input = screen.getByPlaceholderText(/ROOM CODE/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'swp-402!' } });
    expect(input.value).toBe('SWP402');

    fireEvent.change(input, { target: { value: 'abcdefghi' } });
    expect(input.value).toBe('ABCDEF');
  });

  it('validates code against getRoomByCode and calls onJoinSuccess on match', async () => {
    const room = await createRoom('host_user', 'Joinable Arena');
    const onJoinSuccess = vi.fn();

    render(React.createElement(JoinRoomScreen, { onJoinSuccess }));

    const input = screen.getByPlaceholderText(/ROOM CODE/i);
    fireEvent.change(input, { target: { value: room.code.toLowerCase() } });

    const submitBtn = screen.getByRole('button', { name: /join room/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onJoinSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          id: room.id,
          code: room.code,
          name: 'Joinable Arena',
        })
      );
    });
  });

  it('displays error message if room code is not found', async () => {
    render(React.createElement(JoinRoomScreen, { onJoinSuccess: vi.fn() }));

    const input = screen.getByPlaceholderText(/ROOM CODE/i);
    fireEvent.change(input, { target: { value: 'NOPE99' } });

    const submitBtn = screen.getByRole('button', { name: /join room/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/room not found/i)).toBeDefined();
    });
  });

  it('auto-fills and validates room code from URL parameters when mounted', async () => {
    const room = await createRoom('host_user', 'Auto Join Arena');
    const onJoinSuccess = vi.fn();

    // Mock window.location
    const originalLocation = window.location;
    const mockLocation = {
      ...originalLocation,
      search: `?code=${room.code}`,
      pathname: '/',
    };
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
      configurable: true,
    });

    try {
      render(React.createElement(JoinRoomScreen, { onJoinSuccess, autoJoin: true }));

      await waitFor(() => {
        expect(onJoinSuccess).toHaveBeenCalledWith(
          expect.objectContaining({
            id: room.id,
            code: room.code,
          })
        );
      });
    } finally {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    }
  });
});

describe('useRoomData Hook', () => {
  beforeEach(() => {
    resetMockRoomStoreForTesting();
  });

  it('fetches room data, ideas, and computes champions leaderboard in offline/mock mode', async () => {
    const room = await createRoom('host_1', 'Live Test Room', 2);
    const docSample = `
### ★ I-001 First Idea
- Status: pot
- Idea: First description.

### ★ I-002 Second Idea
- Status: pot
- Idea: Second description.
    `.trim();

    await syncGoogleDoc(room.id, 'doc1', docSample);

    // Record some swipes
    const ideas = await getRoomByCode(room.code);
    expect(ideas).toBeDefined();

    const { result } = renderHook(() => useRoomData(room.id, 2));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.room).toBeDefined();
      expect(result.current.ideas).toHaveLength(2);
      expect(result.current.champions).toBeDefined();
    });
  });
});
