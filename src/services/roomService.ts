import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Room, Idea, RoomSchedule, GoogleDocConfig } from '../types';
import { parseIdeasFromDoc } from '../lib/parser';
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

/**
 * Reset mock stores for isolated unit and integration testing.
 */
export function resetMockRoomStoreForTesting(): void {
  mockRooms.clear();
  mockRoomsByCode.clear();
  mockIdeasByRoom.clear();
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

      for (const idea of parsedIdeas) {
        const ideaRef = doc(db, 'rooms', roomId, 'ideas', idea.id);
        await setDoc(ideaRef, idea, { merge: true });
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

  // Merge ideas: keep existing score/likes/passes if idea code already exists
  const existing = mockIdeasByRoom.get(roomId) || [];
  const existingMap = new Map(existing.map((i) => [i.code.toUpperCase(), i]));

  const merged = parsedIdeas.map((newIdea) => {
    const prev = existingMap.get(newIdea.code.toUpperCase());
    if (prev) {
      return {
        ...newIdea,
        status: prev.status, // preserve curation status if previously toggled
        likesCount: prev.likesCount,
        passesCount: prev.passesCount,
        score: prev.score,
      };
    }
    return newIdea;
  });

  // Retain any existing ideas that weren't in the incoming doc
  const incomingCodes = new Set(parsedIdeas.map((i) => i.code.toUpperCase()));
  for (const prev of existing) {
    if (!incomingCodes.has(prev.code.toUpperCase())) {
      merged.push(prev);
    }
  }

  mockIdeasByRoom.set(roomId, merged);
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
  }
}
