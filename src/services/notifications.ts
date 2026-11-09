import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, isFirebaseConfigured, app } from './firebase';

// In-memory fallback token store for offline mode and testing
const mockUserTokens = new Map<string, Set<string>>();

/**
 * Resets the in-memory mock notification store for testing.
 */
export function resetMockNotificationStoreForTesting(): void {
  mockUserTokens.clear();
}

/**
 * Retrieves the recorded FCM tokens for a user from the in-memory mock store.
 */
export function getMockUserTokensForTesting(userId: string): string[] {
  const tokens = mockUserTokens.get(userId);
  return tokens ? Array.from(tokens) : [];
}

/**
 * Checks current notification permission or returns 'unsupported'
 * if the Notification API is not present.
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Registers the background FCM service worker (/firebase-messaging-sw.js).
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    return registration;
  } catch (error) {
    console.warn('[notifications] Service worker registration failed:', error);
    return null;
  }
}

/**
 * Persists an FCM token to the user profile in Firestore (when configured)
 * or the in-memory mock store (in offline mode).
 */
export async function saveTokenToUserProfile(userId: string, token: string): Promise<void> {
  if (!userId || !token) return;

  // Record in in-memory store
  if (!mockUserTokens.has(userId)) {
    mockUserTokens.set(userId, new Set());
  }
  mockUserTokens.get(userId)!.add(token);

  if (isFirebaseConfigured && db) {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          fcmTokens: arrayUnion(token),
        });
      } else {
        await setDoc(
          userRef,
          {
            uid: userId,
            fcmTokens: [token],
          },
          { merge: true }
        );
      }
    } catch (err) {
      console.warn('[notifications] Failed to update user profile in Firestore:', err);
    }
  }
}

/**
 * Prompts user for notification permission, registers service worker and FCM token,
 * and attaches the token to the user profile. Degrades gracefully on denial.
 */
export async function requestNotificationPermission(userId?: string): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return null;
    }

    // Try real FCM getToken if Firebase is configured
    if (isFirebaseConfigured && app) {
      try {
        const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
        const supported = await isSupported();
        if (supported) {
          const messaging = getMessaging(app);
          const swRegistration = await registerServiceWorker();
          const metaEnv =
            (import.meta as unknown as { env?: Record<string, string | undefined> })?.env || {};
          const vapidKey = metaEnv.VITE_FIREBASE_VAPID_KEY;

          const token = await getToken(messaging, {
            serviceWorkerRegistration: swRegistration || undefined,
            vapidKey: vapidKey || undefined,
          });

          if (token) {
            if (userId) {
              await saveTokenToUserProfile(userId, token);
            }
            return token;
          }
        }
      } catch (err) {
        console.warn('[notifications] FCM getToken failed, falling back to mock token:', err);
      }
    }

    // Offline / Mock / Fallback token
    const mockToken = `mock-fcm-token-${Math.random().toString(36).substring(2, 10)}`;
    if (userId) {
      await saveTokenToUserProfile(userId, mockToken);
    }
    return mockToken;
  } catch (error) {
    console.warn('[notifications] Notification permission request error:', error);
    return null;
  }
}
