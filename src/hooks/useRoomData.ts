import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { Room, Idea, Swipe } from '../types';
import {
  getRoom,
  getRoomIdeas,
  getRoomSwipes,
  subscribeToRoomUpdates,
} from '../services/roomService';
import { rankLeaderboardIdeas, pickNextChallengers } from '../lib/leaderboard';
import { db, isFirebaseConfigured } from '../services/firebase';

export interface UseRoomDataResult {
  room: Room | null;
  ideas: Idea[];
  champions: Idea[];
  leaderboard: Idea[];
  activeBatch: Idea[];
  unswipedBatch: Idea[];
  swipedIdeaIds: Set<string>;
  swipes: Swipe[];
  loading: boolean;
  error: string | null;
  participantCount: number;
  totalVotes: number;
  refresh: () => Promise<void>;
}

/**
 * Subscribes in real-time to room state, candidate ideas, user swipes,
 * and calculates King of the Hill champions leaderboard.
 */
export function useRoomData(
  roomIdOrCode?: string | null,
  limit?: number,
  userId?: string | null
): UseRoomDataResult {
  const [room, setRoom] = useState<Room | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [swipes, setSwipes] = useState<Swipe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async (roomIdKey: string) => {
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }

      const fetchedRoom = await getRoom(roomIdKey);
      if (!isMountedRef.current) return;

      if (!fetchedRoom) {
        setRoom(null);
        setIdeas([]);
        setSwipes([]);
        setError(`Room not found: ${roomIdKey}`);
        setLoading(false);
        return;
      }

      setRoom(fetchedRoom);

      const [fetchedIdeas, fetchedSwipes] = await Promise.all([
        getRoomIdeas(fetchedRoom.id),
        getRoomSwipes(fetchedRoom.id),
      ]);

      if (!isMountedRef.current) return;
      setIdeas(fetchedIdeas);
      setSwipes(fetchedSwipes);
      setLoading(false);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('[useRoomData] Error loading room data:', err);
      setError(err?.message || 'Failed to load room data');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!roomIdOrCode) {
      setRoom(null);
      setIdeas([]);
      setSwipes([]);
      setLoading(false);
      return;
    }

    let unsubRoom: (() => void) | undefined;
    let unsubIdeas: (() => void) | undefined;
    let unsubSwipes: (() => void) | undefined;
    let unsubMockUpdates: (() => void) | undefined;

    let resolvedRoomId: string | null = null;

    loadData(roomIdOrCode).then(() => {
      getRoom(roomIdOrCode).then((r) => {
        if (!r || !isMountedRef.current) return;
        resolvedRoomId = r.id;

        if (isFirebaseConfigured && db) {
          try {
            const roomRef = doc(db, 'rooms', resolvedRoomId);
            unsubRoom = onSnapshot(
              roomRef,
              (snap) => {
                if (snap.exists() && isMountedRef.current) {
                  setRoom(snap.data() as Room);
                }
              },
              (err) => console.warn('[useRoomData] Firebase room snapshot error:', err)
            );

            const ideasCol = collection(db, 'rooms', resolvedRoomId, 'ideas');
            unsubIdeas = onSnapshot(
              ideasCol,
              (snap) => {
                if (isMountedRef.current) {
                  setIdeas(snap.docs.map((d) => d.data() as Idea));
                }
              },
              (err) => console.warn('[useRoomData] Firebase ideas snapshot error:', err)
            );

            const swipesCol = collection(db, 'rooms', resolvedRoomId, 'swipes');
            unsubSwipes = onSnapshot(
              swipesCol,
              (snap) => {
                if (isMountedRef.current) {
                  setSwipes(snap.docs.map((d) => d.data() as Swipe));
                }
              },
              (err) => console.warn('[useRoomData] Firebase swipes snapshot error:', err)
            );
          } catch (err) {
            console.warn('[useRoomData] Failed to attach Firestore listeners:', err);
          }
        } else {
          // In-memory offline real-time subscription
          unsubMockUpdates = subscribeToRoomUpdates((updatedRoomId) => {
            if (updatedRoomId === resolvedRoomId && isMountedRef.current) {
              getRoomIdeas(resolvedRoomId).then((newIdeas) => {
                if (isMountedRef.current) setIdeas(newIdeas);
              });
              getRoomSwipes(resolvedRoomId).then((newSwipes) => {
                if (isMountedRef.current) setSwipes(newSwipes);
              });
            }
          });
        }
      });
    });

    return () => {
      unsubRoom?.();
      unsubIdeas?.();
      unsubSwipes?.();
      unsubMockUpdates?.();
    };
  }, [roomIdOrCode, loadData]);

  const refresh = useCallback(async () => {
    if (roomIdOrCode) {
      await loadData(roomIdOrCode);
    }
  }, [roomIdOrCode, loadData]);

  const effectiveLimit = limit ?? room?.leaderboardLimit ?? 3;

  const champions = useMemo(() => {
    return rankLeaderboardIdeas(ideas, effectiveLimit);
  }, [ideas, effectiveLimit]);

  const activeBatch = useMemo(() => {
    const activeIds = room?.activeIdeaIds || [];
    if (activeIds.length > 0) {
      const ideasById = new Map(ideas.map((i) => [i.id, i]));
      return activeIds
        .map((id) => ideasById.get(id))
        .filter((i): i is Idea => Boolean(i && i.status !== 'archived'));
    }
    // Fallback: If activeIdeaIds is empty, fallback to taking up to N ideas from pot
    const pot = ideas.filter(
      (idea) => idea.status === 'pot' || (!idea.status && idea.status !== 'archived')
    );
    return pickNextChallengers(pot, effectiveLimit);
  }, [ideas, room?.activeIdeaIds, effectiveLimit]);

  const swipedIdeaIds = useMemo(() => {
    const ids = new Set<string>();
    if (!userId) return ids;
    for (const s of swipes) {
      if (s.userId === userId) {
        ids.add(s.ideaId);
      }
    }
    return ids;
  }, [swipes, userId]);

  const unswipedBatch = useMemo(() => {
    if (swipedIdeaIds.size === 0) return activeBatch;
    return activeBatch.filter((idea) => !swipedIdeaIds.has(idea.id));
  }, [activeBatch, swipedIdeaIds]);

  const participantCount = useMemo(() => {
    const userIds = new Set(swipes.map((s) => s.userId).filter(Boolean));
    return userIds.size;
  }, [swipes]);

  const totalVotes = useMemo(() => {
    if (swipes.length > 0) {
      return swipes.length;
    }
    return ideas.reduce(
      (sum, idea) => sum + (idea.likesCount || 0) + (idea.passesCount || 0),
      0
    );
  }, [swipes, ideas]);

  return {
    room,
    ideas,
    champions,
    leaderboard: champions,
    activeBatch,
    unswipedBatch,
    swipedIdeaIds,
    swipes,
    loading,
    error,
    participantCount,
    totalVotes,
    refresh,
  };
}
