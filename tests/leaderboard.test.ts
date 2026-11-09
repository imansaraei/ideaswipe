import { describe, it, expect } from 'vitest';
import { evaluateKingOfTheHill, rankLeaderboardIdeas } from '../src/lib/leaderboard';

describe('evaluateKingOfTheHill', () => {
  it('dethrones a lower scoring champion when challenger has higher consensus', () => {
    const champions = [
      { id: '1', score: 0.8, likesCount: 4, passesCount: 1 } as any,
      { id: '2', score: 0.5, likesCount: 2, passesCount: 2 } as any,
    ];
    const challengers = [
      { id: '3', score: 0.9, likesCount: 9, passesCount: 1 } as any,
    ];

    const result = evaluateKingOfTheHill(champions, challengers, 2);
    expect(result.champions.map(c => c.id)).toEqual(['3', '1']);
    expect(result.backToPot.map(b => b.id)).toEqual(['2']);
  });

  it('keeps existing champions if challengers score lower', () => {
    const champions = [
      { id: '1', score: 0.85, likesCount: 17, passesCount: 3 } as any,
      { id: '2', score: 0.7, likesCount: 7, passesCount: 3 } as any,
    ];
    const challengers = [
      { id: '3', score: 0.4, likesCount: 4, passesCount: 6 } as any,
    ];

    const result = evaluateKingOfTheHill(champions, challengers, 2);
    expect(result.champions.map(c => c.id)).toEqual(['1', '2']);
    expect(result.backToPot.map(b => b.id)).toEqual(['3']);
  });

  it('fills empty champion slots when champions count is below limit', () => {
    const champions = [
      { id: '1', score: 0.9, likesCount: 9, passesCount: 1 } as any,
    ];
    const challengers = [
      { id: '2', score: 0.8, likesCount: 8, passesCount: 2 } as any,
      { id: '3', score: 0.6, likesCount: 6, passesCount: 4 } as any,
    ];

    const result = evaluateKingOfTheHill(champions, challengers, 3);
    expect(result.champions.map(c => c.id)).toEqual(['1', '2', '3']);
    expect(result.backToPot).toEqual([]);
  });

  it('handles empty inputs gracefully', () => {
    const result = evaluateKingOfTheHill([], [], 3);
    expect(result.champions).toEqual([]);
    expect(result.backToPot).toEqual([]);
  });
});

describe('rankLeaderboardIdeas', () => {
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
});
