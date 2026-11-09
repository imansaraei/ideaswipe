import * as admin from 'firebase-admin';
import { evaluateKingOfTheHill } from '../../src/lib/leaderboard';
import { Idea, Room, RoomSchedule } from '../../src/types';
import { sendBatchNotification, BatchNotificationResult } from './notifications';

export interface ShuffleResult {
  roomId: string;
  champions: Idea[];
  dethroned: Idea[];
  nextChallengers: Idea[];
  activeIdeaIds: string[];
  notifications: BatchNotificationResult;
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

/**
 * Checks whether a room schedule is due for a shuffle at the given timestamp.
 */
export function isRoomDueForShuffle(
  schedule?: RoomSchedule,
  now: Date = new Date()
): boolean {
  if (!schedule || !schedule.enabled || !schedule.time) {
    return false;
  }

  // Determine current day of week and hour
  let dayOfWeek = now.getUTCDay();
  let currentHour = now.getUTCHours();

  // If a timezone is specified, attempt to extract hour and day in that timezone
  if (schedule.timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: schedule.timezone,
        hour: 'numeric',
        hourCycle: 'h23',
        weekday: 'short',
      });
      const parts = formatter.formatToParts(now);
      const hourPart = parts.find((p) => p.type === 'hour');
      if (hourPart) {
        currentHour = parseInt(hourPart.value, 10);
      }
      const dayMap: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };
      const weekdayPart = parts.find((p) => p.type === 'weekday');
      if (weekdayPart && dayMap[weekdayPart.value] !== undefined) {
        dayOfWeek = dayMap[weekdayPart.value];
      }
    } catch {
      // Fallback to UTC if timezone is invalid
    }
  }

  // Check day of week
  if (
    Array.isArray(schedule.daysOfWeek) &&
    schedule.daysOfWeek.length > 0 &&
    !schedule.daysOfWeek.includes(dayOfWeek)
  ) {
    return false;
  }

  // Parse target hour from "HH:mm"
  const timeParts = schedule.time.split(':');
  const targetHour = parseInt(timeParts[0], 10);

  return currentHour === targetHour;
}

/**
 * Executes a daily room shuffle:
 * 1. Evaluates current active challengers against champions via King of the Hill.
 * 2. Updates champion and dethroned idea statuses in Firestore.
 * 3. Selects the next N challengers from the pot.
 * 4. Updates the room's activeIdeaIds and lastShuffledAt.
 * 5. Triggers FCM push notifications for room participants.
 */
export async function executeRoomShuffle(
  roomId: string,
  db?: any,
  customMessaging?: any
): Promise<ShuffleResult> {
  if (!roomId) {
    throw new Error('roomId is required for executeRoomShuffle');
  }

  let firestore = db;
  if (!firestore) {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    firestore = admin.firestore();
  }

  const roomDocRef = firestore.collection('rooms').doc(roomId);
  const roomSnap = await roomDocRef.get();

  if (!roomSnap.exists && typeof roomSnap.data !== 'function') {
    throw new Error(`Room not found: ${roomId}`);
  }

  const room = (roomSnap.data ? roomSnap.data() : roomSnap) as Room;
  if (!room) {
    throw new Error(`Room data is empty: ${roomId}`);
  }

  const limit = room.leaderboardLimit && room.leaderboardLimit > 0 ? room.leaderboardLimit : 3;
  const currentActiveIds = new Set(room.activeIdeaIds || []);

  // Fetch all ideas for the room
  const ideasCol = roomDocRef.collection('ideas');
  const ideasSnap = await ideasCol.get();
  const allIdeas: Idea[] = (ideasSnap.docs || []).map((doc: any) => ({
    id: doc.id,
    ...(doc.data ? doc.data() : doc),
  }));

  // Separate ideas into current champions, active challengers, and pot ideas
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

  // Evaluate King of the Hill promotion/dethroning
  const kothResult = evaluateKingOfTheHill(currentChampions, currentChallengers, limit);
  const { champions, backToPot } = kothResult;

  // Persist updated statuses
  for (const champ of champions) {
    await ideasCol.doc(champ.id).update({
      status: 'active',
      score: champ.score,
      updatedAt: Date.now(),
    });
  }

  for (const dethroned of backToPot) {
    await ideasCol.doc(dethroned.id).update({
      status: 'pot',
      score: dethroned.score,
      updatedAt: Date.now(),
    });
  }

  // Pool remaining pot ideas with newly dethroned ideas
  const championIds = new Set(champions.map((c) => c.id));
  const availablePot = [...potIdeas, ...backToPot].filter(
    (idea) => !championIds.has(idea.id)
  );

  // Select next N challengers
  const nextChallengers = pickNextChallengers(availablePot, limit);
  const nextActiveIds = nextChallengers.map((c) => c.id);

  // Update room
  const now = Date.now();
  await roomDocRef.update({
    activeIdeaIds: nextActiveIds,
    lastShuffledAt: now,
  });

  // Collect member tokens for notification
  const tokens = new Set<string>();

  // Check host user profile
  try {
    const usersCol = firestore.collection('users');
    if (room.hostUserId && typeof usersCol.doc === 'function') {
      const hostSnap = await usersCol.doc(room.hostUserId).get();
      if (hostSnap && (hostSnap.exists || typeof hostSnap.data === 'function')) {
        const hostData = hostSnap.data ? hostSnap.data() : hostSnap;
        if (Array.isArray(hostData?.fcmTokens)) {
          hostData.fcmTokens.forEach((t: string) => tokens.add(t));
        }
      }
    }
  } catch (err) {
    console.warn('[executeRoomShuffle] Failed to query host tokens:', err);
  }

  // Query all members who joined this room
  try {
    const usersCol = firestore.collection('users');
    if (typeof usersCol.where === 'function') {
      const membersSnap = await usersCol
        .where('roomsJoined', 'array-contains', roomId)
        .get();

      if (membersSnap && membersSnap.docs) {
        for (const memberDoc of membersSnap.docs) {
          const memberData = memberDoc.data ? memberDoc.data() : memberDoc;
          if (Array.isArray(memberData?.fcmTokens)) {
            memberData.fcmTokens.forEach((t: string) => tokens.add(t));
          }
        }
      }
    }
  } catch (err) {
    console.warn('[executeRoomShuffle] Failed to query member tokens:', err);
  }

  if (Array.isArray((room as any).memberTokens)) {
    (room as any).memberTokens.forEach((t: string) => tokens.add(t));
  }

  // Trigger push notifications
  const notificationResult = await sendBatchNotification(
    Array.from(tokens),
    room.name || 'IdeaSwipe',
    nextChallengers.length,
    room.code,
    customMessaging
  );

  return {
    roomId,
    champions,
    dethroned: backToPot,
    nextChallengers,
    activeIdeaIds: nextActiveIds,
    notifications: notificationResult,
  };
}
