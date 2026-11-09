import * as admin from 'firebase-admin';

export interface BatchNotificationResult {
  successCount: number;
  failureCount: number;
}

/**
 * Sends a multicast push notification via FCM to room members
 * announcing a new batch of ideas ready to swipe.
 *
 * Gracefully filters out invalid/empty tokens.
 */
export async function sendBatchNotification(
  tokens: string[],
  roomName: string,
  batchSize: number,
  roomCode?: string,
  customMessaging?: any
): Promise<BatchNotificationResult> {
  // Gracefully filter empty, whitespace-only, or non-string tokens and deduplicate
  const validTokens = Array.from(
    new Set(
      (tokens || [])
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim())
    )
  );

  if (validTokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const payload = {
    tokens: validTokens,
    notification: {
      title: `IdeaSwipe: New batch in ${roomName}`,
      body: `Your ${batchSize} new ideas are ready to swipe today.`,
    },
    data: {
      url: `/join/${roomCode || ''}`,
    },
  };

  try {
    let messaging = customMessaging;
    if (!messaging) {
      if (!admin.apps.length) {
        admin.initializeApp();
      }
      messaging = admin.messaging();
    }

    if (typeof messaging.sendEachForMulticast === 'function') {
      const response = await messaging.sendEachForMulticast(payload);
      return {
        successCount: response.successCount ?? 0,
        failureCount: response.failureCount ?? 0,
      };
    } else if (typeof messaging.sendMulticast === 'function') {
      const response = await messaging.sendMulticast(payload);
      return {
        successCount: response.successCount ?? 0,
        failureCount: response.failureCount ?? 0,
      };
    } else {
      console.warn('[notifications] No compatible multicast method found on messaging instance');
      return { successCount: 0, failureCount: validTokens.length };
    }
  } catch (error) {
    console.error('[notifications] Failed to send FCM multicast notification:', error);
    return {
      successCount: 0,
      failureCount: validTokens.length,
    };
  }
}
