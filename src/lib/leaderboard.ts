import { Idea, KingOfTheHillResult } from '../types';

/**
 * Calculates positive consensus percentage (likes / (likes + passes)).
 * Returns 0 if no votes have been recorded.
 */
export function calculateIdeaScore(likesCount: number, passesCount: number): number {
  const total = (likesCount || 0) + (passesCount || 0);
  return total > 0 ? (likesCount || 0) / total : 0;
}

/**
 * Evaluates challengers against current champions in a King of the Hill format.
 * The top N ideas with highest consensus remain champions.
 * Lower scoring champions and non-qualifying challengers are placed back into the pot.
 */
export function evaluateKingOfTheHill(
  currentChampions: Idea[],
  challengers: Idea[],
  limit: number = 3
): KingOfTheHillResult {
  const poolMap = new Map<string, Idea>();

  // Insert champions first, then challengers (challengers override or supplement)
  for (const idea of currentChampions) {
    if (idea && idea.id) {
      poolMap.set(idea.id, idea);
    }
  }
  for (const idea of challengers) {
    if (idea && idea.id) {
      poolMap.set(idea.id, idea);
    }
  }

  const getScore = (idea: Idea): number => {
    const total = (idea.likesCount || 0) + (idea.passesCount || 0);
    if (total > 0) return (idea.likesCount || 0) / total;
    if (typeof idea.score === 'number' && !isNaN(idea.score)) {
      return idea.score;
    }
    return 0;
  };

  const sortedCandidates = Array.from(poolMap.values()).sort((a, b) => {
    const scoreA = getScore(a);
    const scoreB = getScore(b);
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    const likesA = a.likesCount || 0;
    const likesB = b.likesCount || 0;
    if (likesB !== likesA) {
      return likesB - likesA;
    }

    const totalA = likesA + (a.passesCount || 0);
    const totalB = likesB + (b.passesCount || 0);
    if (totalB !== totalA) {
      return totalB - totalA;
    }

    return (a.id || '').localeCompare(b.id || '');
  });

  const effectiveLimit = Math.max(0, limit);
  const champions = sortedCandidates.slice(0, effectiveLimit).map(idea => ({
    ...idea,
    score: getScore(idea),
    status: 'active' as const,
  }));

  const championIdSet = new Set(champions.map(c => c.id));
  const backToPot = sortedCandidates
    .filter(idea => !championIdSet.has(idea.id))
    .map(idea => ({
      ...idea,
      score: getScore(idea),
      status: (idea.status === 'archived' ? 'archived' : 'pot') as 'pot' | 'archived',
    }));

  return { champions, backToPot };
}

/**
 * Ranks ideas strictly by consensus like percentage descending.
 * Optionally truncates to leaderboard limit N.
 */
export function rankLeaderboardIdeas(ideas: Idea[], limit?: number): Idea[] {
  const getScore = (idea: Idea): number => {
    const total = (idea.likesCount || 0) + (idea.passesCount || 0);
    if (total > 0) return (idea.likesCount || 0) / total;
    if (typeof idea.score === 'number' && !isNaN(idea.score)) {
      return idea.score;
    }
    return 0;
  };

  const sorted = [...ideas]
    .map(idea => ({
      ...idea,
      score: getScore(idea),
    }))
    .sort((a, b) => {
      const scoreA = a.score;
      const scoreB = b.score;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      const likesA = a.likesCount || 0;
      const likesB = b.likesCount || 0;
      if (likesB !== likesA) {
        return likesB - likesA;
      }

      return (a.id || '').localeCompare(b.id || '');
    });

  return typeof limit === 'number' ? sorted.slice(0, Math.max(0, limit)) : sorted;
}

/**
 * Selects the next N challenger ideas from the room's pot.
 * Prioritizes unvoted ideas over previously voted/dethroned ideas.
 * If fewer than N ideas remain in the pot, returns all available pot ideas
 * safely without throwing or looping.
 */
export function pickNextChallengers(
  potIdeas: Idea[] | null | undefined,
  count: number
): Idea[] {
  if (!potIdeas || !Array.isArray(potIdeas) || count <= 0) {
    return [];
  }

  const pot = potIdeas.filter(
    (idea) => idea && (idea.status === 'pot' || !idea.status)
  );

  const unvoted = pot.filter(
    (idea) => ((idea.likesCount || 0) + (idea.passesCount || 0)) === 0
  );
  const voted = pot.filter(
    (idea) => ((idea.likesCount || 0) + (idea.passesCount || 0)) > 0
  );

  const ordered = [...unvoted, ...voted];
  return ordered.slice(0, count);
}

