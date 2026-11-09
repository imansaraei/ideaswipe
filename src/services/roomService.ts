import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, increment, writeBatch } from 'firebase/firestore';
import { Room, Idea, RoomSchedule, GoogleDocConfig, Swipe } from '../types';
import { parseIdeasFromDoc } from '../lib/parser';
import { evaluateKingOfTheHill, pickNextChallengers } from '../lib/leaderboard';
import { generateRoomCode } from './auth';
import { db, isFirebaseConfigured } from './firebase';

export const GOOGLE_DOC_MARKDOWN_TEMPLATE = `### ★ I-001 Title of Idea
- Status: pot
- One-liner: A crisp single sentence describing the concept.
- Category: General
- Problem: Why this matters and what pain point it eliminates.
- Next step: The smallest immediate test to validate it.
`.trim();

// In-memory offline fallback stores
const mockRooms = new Map<string, Room>();
const mockRoomsByCode = new Map<string, string>();
const mockIdeasByRoom = new Map<string, Idea[]>();
const mockSwipes = new Map<string, Swipe>();
const roomListeners = new Set<(roomId: string) => void>();

export function subscribeToRoomUpdates(callback: (roomId: string) => void): () => void {
  roomListeners.add(callback);
  return () => {
    roomListeners.delete(callback);
  };
}

function notifyRoomUpdated(roomId: string) {
  roomListeners.forEach((cb) => {
    try {
      cb(roomId);
    } catch (err) {
      console.warn('[RoomService] Listener error:', err);
    }
  });
}

/**
 * Reset mock stores for isolated unit and integration testing.
 */
export function resetMockRoomStoreForTesting(): void {
  mockRooms.clear();
  mockRoomsByCode.clear();
  mockIdeasByRoom.clear();
  mockSwipes.clear();
}

/**
 * Extracts a Google Doc ID from a full document URL or returns the raw ID if already clean.
 */
export function extractDocIdFromUrl(urlOrId: string): string {
  if (!urlOrId || typeof urlOrId !== 'string') {
    return '';
  }

  const trimmed = urlOrId.trim();
  if (!trimmed) {
    return '';
  }

  // Handle standard Google Doc URL format:
  // https://docs.google.com/document/d/{DOC_ID}/edit...
  const urlMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Handle raw Doc ID: typical IDs are 20-50 alphanumeric characters with dashes/underscores
  const rawMatch = trimmed.match(/^[a-zA-Z0-9_-]{10,}$/);
  if (rawMatch) {
    return trimmed;
  }

  return trimmed;
}

/**
 * Creates a new idea-curation room.
 */
export async function createRoom(
  hostUserId: string,
  name: string,
  limit: number = 3,
  schedule?: RoomSchedule
): Promise<Room> {
  const code = generateRoomCode();
  const id = `room_${code.toLowerCase()}_${Date.now()}`;
  const leaderboardLimit = Number(limit) > 0 ? Number(limit) : 3;

  const room: Room = {
    id,
    code,
    name: name.trim() || 'Untitled Room',
    hostUserId,
    leaderboardLimit,
    activeIdeaIds: [],
    createdAt: Date.now(),
  };

  if (schedule) {
    room.schedule = schedule;
  }

  if (isFirebaseConfigured && db) {
    try {
      const roomRef = doc(db, 'rooms', id);
      await setDoc(roomRef, room);
      return room;
    } catch (err) {
      console.warn('[RoomService] Firebase save failed, falling back to mock store:', err);
    }
  }

  // Offline / Mock storage
  mockRooms.set(id, room);
  mockRoomsByCode.set(code.toUpperCase(), id);
  mockIdeasByRoom.set(id, []);

  return room;
}

/**
 * Retrieves a room by its unique ID or 6-character room code.
 */
export async function getRoom(roomIdOrCode: string): Promise<Room | null> {
  if (!roomIdOrCode || typeof roomIdOrCode !== 'string') {
    return null;
  }

  const queryKey = roomIdOrCode.trim();
  const upperCode = queryKey.toUpperCase();

  if (isFirebaseConfigured && db) {
    try {
      // Try direct ID lookup first
      const roomRef = doc(db, 'rooms', queryKey);
      const snapshot = await getDoc(roomRef);
      if (snapshot.exists()) {
        return snapshot.data() as Room;
      }

      // Try code query
      const roomsQuery = query(collection(db, 'rooms'), where('code', '==', upperCode));
      const querySnap = await getDocs(roomsQuery);
      if (!querySnap.empty) {
        return querySnap.docs[0].data() as Room;
      }
    } catch (err) {
      console.warn('[RoomService] Firebase getRoom failed, falling back to mock store:', err);
    }
  }

  // Offline lookup
  if (mockRooms.has(queryKey)) {
    return mockRooms.get(queryKey) || null;
  }

  const idFromCode = mockRoomsByCode.get(upperCode);
  if (idFromCode && mockRooms.has(idFromCode)) {
    return mockRooms.get(idFromCode) || null;
  }

  return null;
}

/**
 * Retrieves a room by its 6-character room code.
 */
export async function getRoomByCode(code: string): Promise<Room | null> {
  return getRoom(code);
}

/**
 * Retrieves all ideas in a room.
 */
export async function getRoomIdeas(roomId: string): Promise<Idea[]> {
  if (!roomId) return [];

  if (isFirebaseConfigured && db) {
    try {
      const ideasCol = collection(db, 'rooms', roomId, 'ideas');
      const snap = await getDocs(ideasCol);
      return snap.docs.map((d) => d.data() as Idea);
    } catch (err) {
      console.warn('[RoomService] Firebase getRoomIdeas failed, falling back to mock store:', err);
    }
  }

  return mockIdeasByRoom.get(roomId) || [];
}

/**
 * Syncs ideas from a Google Doc (via export URL or direct markdown text) into the room.
 */
export async function syncGoogleDoc(
  roomId: string,
  docUrlOrId: string,
  directContent?: string
): Promise<number> {
  const docId = extractDocIdFromUrl(docUrlOrId);
  if (!docId && !directContent) {
    throw new Error('Please provide a valid Google Doc URL or document ID');
  }

  let markdownText = directContent || '';

  if (!markdownText) {
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
    const response = await fetch(exportUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch Google Doc (${response.status} ${response.statusText}). Ensure document sharing is set to "Anyone with link can view".`
      );
    }
    markdownText = await response.text();
  }

  const parsedIdeas = parseIdeasFromDoc(markdownText);
  if (parsedIdeas.length === 0) {
    return 0;
  }

  const googleDocConfig: GoogleDocConfig = {
    docId: docId || 'manual-sync',
    lastSyncedAt: Date.now(),
  };

  if (isFirebaseConfigured && db) {
    try {
      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, { googleDoc: googleDocConfig });

      const ideasCol = collection(db, 'rooms', roomId, 'ideas');
      const existingSnap = await getDocs(ideasCol);
      const existingMap = new Map<string, Idea>();
      existingSnap.docs.forEach((d) => {
        const data = d.data() as Idea;
        existingMap.set(data.id, data);
        if (data.code) {
          existingMap.set(data.code.toUpperCase(), data);
        }
      });

      for (const idea of parsedIdeas) {
        const prev = existingMap.get(idea.id) || (idea.code ? existingMap.get(idea.code.toUpperCase()) : undefined);
        const mergedIdea: Idea = prev
          ? {
              ...idea,
              likesCount: prev.likesCount ?? 0,
              passesCount: prev.passesCount ?? 0,
              score: prev.score ?? 0,
              status: idea.status === 'archived' ? 'archived' : prev.status,
            }
          : idea;
        const ideaRef = doc(db, 'rooms', roomId, 'ideas', mergedIdea.id);
        await setDoc(ideaRef, mergedIdea, { merge: true });
      }

      return parsedIdeas.length;
    } catch (err) {
      console.warn('[RoomService] Firebase syncGoogleDoc failed, falling back to mock store:', err);
    }
  }

  // Update room in mock store
  const room = mockRooms.get(roomId);
  if (room) {
    room.googleDoc = googleDocConfig;
  }

  // Merge ideas: keep existing score/likes/passes if idea code or id already exists
  const existing = mockIdeasByRoom.get(roomId) || [];
  const existingMap = new Map<string, Idea>();
  existing.forEach((i) => {
    existingMap.set(i.id, i);
    if (i.code) {
      existingMap.set(i.code.toUpperCase(), i);
    }
  });

  const merged = parsedIdeas.map((newIdea) => {
    const prev = existingMap.get(newIdea.id) || (newIdea.code ? existingMap.get(newIdea.code.toUpperCase()) : undefined);
    if (prev) {
      return {
        ...newIdea,
        status: newIdea.status === 'archived' ? 'archived' : prev.status, // preserve curation status unless doc explicitly dropped
        likesCount: prev.likesCount,
        passesCount: prev.passesCount,
        score: prev.score,
      };
    }
    return newIdea;
  });

  // Retain any existing ideas that weren't in the incoming doc
  const incomingCodes = new Set(parsedIdeas.map((i) => i.code.toUpperCase()));
  const incomingIds = new Set(parsedIdeas.map((i) => i.id));
  for (const prev of existing) {
    if (!incomingCodes.has(prev.code.toUpperCase()) && !incomingIds.has(prev.id)) {
      merged.push(prev);
    }
  }

  mockIdeasByRoom.set(roomId, merged);
  notifyRoomUpdated(roomId);
  return parsedIdeas.length;
}

/**
 * Moves an idea between 'pot' and 'archived' status.
 */
export async function toggleIdeaStatus(
  roomId: string,
  ideaId: string,
  status: 'pot' | 'archived'
): Promise<void> {
  if (!roomId || !ideaId) return;

  if (isFirebaseConfigured && db) {
    try {
      const ideaRef = doc(db, 'rooms', roomId, 'ideas', ideaId);
      await updateDoc(ideaRef, { status, updatedAt: Date.now() });
      return;
    } catch (err) {
      console.warn('[RoomService] Firebase toggleIdeaStatus failed, falling back to mock store:', err);
    }
  }

  const ideas = mockIdeasByRoom.get(roomId) || [];
  const target = ideas.find((i) => i.id === ideaId);
  if (target) {
    target.status = status;
    target.updatedAt = Date.now();
    notifyRoomUpdated(roomId);
  }
}

/**
 * Records a user swipe (like or pass) on an idea.
 * Atomically creates a swipe document and increments the idea's vote counter.
 */
export async function recordSwipe(
  roomId: string,
  userId: string,
  ideaId: string,
  direction: 'like' | 'pass'
): Promise<Swipe> {
  if (!roomId || !userId || !ideaId) {
    throw new Error('roomId, userId, and ideaId are required to record a swipe');
  }

  const swipeId = `${userId}_${ideaId}`;
  const swipe: Swipe = {
    id: swipeId,
    userId,
    ideaId,
    vote: direction,
    timestamp: Date.now(),
  };

  if (isFirebaseConfigured && db) {
    try {
      const swipeRef = doc(db, 'rooms', roomId, 'swipes', swipeId);
      const existingSnap = await getDoc(swipeRef);
      if (existingSnap.exists()) {
        // Double-vote prevention: do not increment vote counters if already swiped
        return existingSnap.data() as Swipe;
      }

      const ideaRef = doc(db, 'rooms', roomId, 'ideas', ideaId);

      const batch = writeBatch(db);
      batch.set(swipeRef, swipe);
      batch.update(ideaRef, {
        [direction === 'like' ? 'likesCount' : 'passesCount']: increment(1),
        updatedAt: Date.now(),
      });
      await batch.commit();
      return swipe;
    } catch (err) {
      console.warn('[RoomService] Firebase recordSwipe failed, falling back to mock store:', err);
    }
  }

  // Offline / Mock fallback
  const mockKey = `${roomId}_${swipeId}`;
  if (mockSwipes.has(mockKey)) {
    // Double-vote prevention: do not increment vote counters if already swiped
    return mockSwipes.get(mockKey)!;
  }

  mockSwipes.set(mockKey, swipe);

  const roomIdeas = mockIdeasByRoom.get(roomId) || [];
  const targetIdea = roomIdeas.find((i) => i.id === ideaId);
  if (targetIdea) {
    if (direction === 'like') {
      targetIdea.likesCount = (targetIdea.likesCount || 0) + 1;
    } else {
      targetIdea.passesCount = (targetIdea.passesCount || 0) + 1;
    }
    const total = (targetIdea.likesCount || 0) + (targetIdea.passesCount || 0);
    targetIdea.score = total > 0 ? (targetIdea.likesCount || 0) / total : 0;
    targetIdea.updatedAt = Date.now();
  }

  notifyRoomUpdated(roomId);
  return swipe;
}

/**
 * Retrieves all swipes recorded for a room or specific user in a room.
 */
export async function getRoomSwipes(roomId: string, userId?: string): Promise<Swipe[]> {
  if (!roomId) return [];

  if (isFirebaseConfigured && db) {
    try {
      const swipesCol = collection(db, 'rooms', roomId, 'swipes');
      const q = userId ? query(swipesCol, where('userId', '==', userId)) : swipesCol;
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as Swipe);
    } catch (err) {
      console.warn('[RoomService] Firebase getRoomSwipes failed, falling back to mock store:', err);
    }
  }

  const results: Swipe[] = [];
  const prefix = `${roomId}_`;
  for (const [key, swipe] of mockSwipes.entries()) {
    if (key.startsWith(prefix)) {
      if (!userId || swipe.userId === userId) {
        results.push(swipe);
      }
    }
  }
  return results;
}

export interface RoomShuffleResult {
  champions: Idea[];
  backToPot: Idea[];
  nextChallengers: Idea[];
  activeIdeaIds: string[];
}

/**
 * Manually shuffles ideas for a room:
 * Evaluates current active challengers against champions via King of the Hill,
 * updates champions/pot, picks next N ideas from pot into activeIdeaIds,
 * and updates lastShuffledAt. Supports both Firestore and mock store.
 */
export async function shuffleRoom(roomId: string): Promise<RoomShuffleResult> {
  if (!roomId) {
    throw new Error('roomId is required to shuffle room');
  }

  const room = await getRoom(roomId);
  if (!room) {
    throw new Error(`Room not found: ${roomId}`);
  }

  const limit = room.leaderboardLimit && room.leaderboardLimit > 0 ? room.leaderboardLimit : 3;
  const currentActiveIds = new Set(room.activeIdeaIds || []);

  const allIdeas = await getRoomIdeas(roomId);

  const currentChampions: Idea[] = [];
  const currentChallengers: Idea[] = [];
  const potIdeas: Idea[] = [];

  for (const idea of allIdeas) {
    if (idea.status === 'archived') {
      continue;
    }
    if (currentActiveIds.has(idea.id)) {
      currentChallengers.push(idea);
    } else if (idea.status === 'active') {
      currentChampions.push(idea);
    } else {
      potIdeas.push(idea);
    }
  }

  const { champions, backToPot } = evaluateKingOfTheHill(currentChampions, currentChallengers, limit);

  const championIds = new Set(champions.map((c) => c.id));
  const availablePot = [...potIdeas, ...backToPot].filter(
    (idea) => !championIds.has(idea.id) && idea.status !== 'archived'
  );

  const nextChallengers = pickNextChallengers(availablePot, limit);
  const nextActiveIds = nextChallengers.map((c) => c.id);
  const now = Date.now();

  if (isFirebaseConfigured && db) {
    try {
      const roomRef = doc(db, 'rooms', roomId);
      const batch = writeBatch(db);

      for (const champ of champions) {
        const champRef = doc(db, 'rooms', roomId, 'ideas', champ.id);
        batch.update(champRef, {
          status: 'active',
          score: champ.score,
          updatedAt: now,
        });
      }

      for (const dethroned of backToPot) {
        const dethronedRef = doc(db, 'rooms', roomId, 'ideas', dethroned.id);
        batch.update(dethronedRef, {
          status: 'pot',
          score: dethroned.score,
          updatedAt: now,
        });
      }

      batch.update(roomRef, {
        activeIdeaIds: nextActiveIds,
        lastShuffledAt: now,
      });

      await batch.commit();

      return {
        champions,
        backToPot,
        nextChallengers,
        activeIdeaIds: nextActiveIds,
      };
    } catch (err) {
      console.warn('[RoomService] Firebase shuffleRoom failed, falling back to mock store:', err);
    }
  }

  // Mock store fallback
  const mockRoom = mockRooms.get(roomId);
  if (mockRoom) {
    mockRoom.activeIdeaIds = nextActiveIds;
    mockRoom.lastShuffledAt = now;
  }

  const mockIdeas = mockIdeasByRoom.get(roomId) || [];
  const champMap = new Map(champions.map((c) => [c.id, c]));
  const backToPotMap = new Map(backToPot.map((d) => [d.id, d]));

  for (const idea of mockIdeas) {
    if (champMap.has(idea.id)) {
      idea.status = 'active';
      idea.score = champMap.get(idea.id)!.score;
      idea.updatedAt = now;
    } else if (backToPotMap.has(idea.id)) {
      idea.status = 'pot';
      idea.score = backToPotMap.get(idea.id)!.score;
      idea.updatedAt = now;
    }
  }

  notifyRoomUpdated(roomId);

  return {
    champions,
    backToPot,
    nextChallengers,
    activeIdeaIds: nextActiveIds,
  };
}

