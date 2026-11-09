import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { executeRoomShuffle, isRoomDueForShuffle, pickNextChallengers, ShuffleResult } from './shuffle';
import { sendBatchNotification } from './notifications';
import { parseIdeasFromDoc } from '../../src/lib/parser';
import { Room } from '../../src/types';

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Scheduled Cloud Function running every hour (at minute 0).
 * Queries all rooms and triggers a daily King of the Hill shuffle
 * for rooms whose schedule matches the current hour and day of week.
 */
export const onScheduledShuffle = onSchedule('0 * * * *', async (_event) => {
  const firestore = admin.firestore();
  const roomsSnap = await firestore.collection('rooms').get();

  const now = new Date();
  const shuffledRooms: string[] = [];

  for (const doc of roomsSnap.docs) {
    const room = doc.data() as Room;
    if (room.schedule && isRoomDueForShuffle(room.schedule, now)) {
      // Prevent double-shuffling within the same hour window (50 mins)
      if (room.lastShuffledAt && Date.now() - room.lastShuffledAt < 50 * 60 * 1000) {
        continue;
      }

      try {
        await executeRoomShuffle(doc.id, firestore);
        shuffledRooms.push(doc.id);
      } catch (err) {
        console.error(`[onScheduledShuffle] Failed to shuffle room ${doc.id}:`, err);
      }
    }
  }

  console.log(`[onScheduledShuffle] Completed shuffle for ${shuffledRooms.length} rooms:`, shuffledRooms);
});

/**
 * HTTP endpoint to manually trigger a room shuffle.
 * GET / POST ?roomId=room_123 or { "roomId": "room_123" }
 */
export const apiShuffleRoom = onRequest({ cors: true }, async (req, res) => {
  try {
    const roomId = (req.query.roomId as string) || req.body?.roomId;
    if (!roomId) {
      res.status(400).json({ error: 'Missing required parameter: roomId' });
      return;
    }

    const result = await executeRoomShuffle(roomId);
    res.status(200).json({ success: true, result });
  } catch (error: any) {
    console.error('[apiShuffleRoom] Error:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
});

/**
 * HTTP endpoint to sync ideas from a Google Doc for a room.
 * POST { "roomId": "room_123", "docUrl": "https://docs.google.com/...", "directContent": "### ..." }
 */
export const apiSyncDoc = onRequest({ cors: true }, async (req, res) => {
  try {
    const roomId = (req.query.roomId as string) || req.body?.roomId;
    const docUrl = (req.query.docUrl as string) || req.body?.docUrl;
    const directContent = req.body?.directContent;

    if (!roomId || (!docUrl && !directContent)) {
      res.status(400).json({
        error: 'Missing required parameters: roomId and either docUrl or directContent',
      });
      return;
    }

    let markdown = directContent || '';
    if (!markdown && docUrl) {
      const docMatch = docUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
      const docId = docMatch ? docMatch[1] : docUrl;
      const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
      const response = await fetch(exportUrl);
      if (!response.ok) {
        res.status(502).json({
          error: `Failed to fetch Google Doc: ${response.status} ${response.statusText}`,
        });
        return;
      }
      markdown = await response.text();
    }

    const ideas = parseIdeasFromDoc(markdown);
    const firestore = admin.firestore();
    const roomRef = firestore.collection('rooms').doc(roomId);

    const batch = firestore.batch();
    for (const idea of ideas) {
      const ideaRef = roomRef.collection('ideas').doc(idea.id);
      batch.set(ideaRef, idea, { merge: true });
    }

    batch.update(roomRef, {
      googleDoc: {
        docId: docUrl || 'manual-sync',
        lastSyncedAt: Date.now(),
      },
    });

    await batch.commit();

    res.status(200).json({ success: true, count: ideas.length });
  } catch (error: any) {
    console.error('[apiSyncDoc] Error:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
});

export {
  pickNextChallengers,
  executeRoomShuffle,
  isRoomDueForShuffle,
  sendBatchNotification,
};
export type { ShuffleResult };
