import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  signInAnonymously,
  linkWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  linkWithCredential,
  EmailAuthProvider,
  signInWithCredential,
  type User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  let result = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
    result += ROOM_CODE_CHARS.charAt(randomIndex);
  }
  return result;
}

const mockOtpStore = new Map<string, string>();
let mockCurrentUser: User | null = null;
const authSubscribers = new Set<(user: User | null) => void>();

function notifySubscribers(user: User | null) {
  mockCurrentUser = user;
  authSubscribers.forEach((cb) => {
    try {
      cb(user);
    } catch (err) {
      console.error('[Auth] Error in subscriber callback:', err);
    }
  });
}

export function createMockUser(params: {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
}): User {
  return {
    uid: params.uid,
    email: params.email,
    displayName: params.displayName || params.email.split('@')[0],
    photoURL: params.photoURL || null,
    emailVerified: true,
    isAnonymous: false,
    phoneNumber: null,
    providerId: 'firebase',
    tenantId: null,
    providerData: [],
    metadata: {
      creationTime: new Date().toISOString(),
      lastSignInTime: new Date().toISOString(),
    },
    delete: async () => {},
    getIdToken: async () => 'mock-id-token',
    getIdTokenResult: async () =>
      ({
        token: 'mock-id-token',
        signInProvider: 'google.com',
        claims: {},
        authTime: new Date().toISOString(),
        issuedAtTime: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
      } as any),
    reload: async () => {},
    toJSON: () => ({ uid: params.uid, email: params.email }),
  } as unknown as User;
}

export async function signInWithGoogle(): Promise<User> {
  if (isFirebaseConfigured && auth) {
    const provider = new GoogleAuthProvider();
    if (auth.currentUser?.isAnonymous) {
      // Keep the guest's uid so rooms they host and votes they cast stay theirs.
      try {
        return (await linkWithPopup(auth.currentUser, provider)).user;
      } catch (err: any) {
        const credential = GoogleAuthProvider.credentialFromError(err);
        if (err?.code === 'auth/credential-already-in-use' && credential) {
          return (await signInWithCredential(auth, credential)).user;
        }
        throw err;
      }
    }
    const result = await signInWithPopup(auth, provider);
    return result.user;
  }

  const mockUser = createMockUser({
    uid: 'mock-google-user-' + Math.random().toString(36).substring(2, 8),
    email: 'rater@ideaswipe.local',
    displayName: 'Demo Rater',
    photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=ideaswipe',
  });
  notifySubscribers(mockUser);
  return mockUser;
}

export async function requestEmailOtp(email: string): Promise<void> {
  if (!email || typeof email !== 'string') {
    throw new Error('Email address is required');
  }

  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    throw new Error('Please enter a valid email address');
  }

  if (isFirebaseConfigured && auth) {
    // Real sign-in: Firebase emails a one-time link that finishes sign-in on return.
    await sendSignInLinkToEmail(auth, cleanEmail, {
      url: window.location.href,
      handleCodeInApp: true,
    });
    localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, cleanEmail);
    return;
  }

  // Offline demo only: generate a 6-digit OTP kept in memory

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  mockOtpStore.set(cleanEmail, otp);
}

export async function verifyEmailOtp(email: string, code: string): Promise<User> {
  if (!email) {
    throw new Error('Email address is required');
  }
  if (!code || typeof code !== 'string') {
    throw new Error('Verification code is required');
  }

  const cleanCode = code.trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error('Verification code must be 6 digits');
  }

  const cleanEmail = email.trim().toLowerCase();
  const storedOtp = mockOtpStore.get(cleanEmail);

  // Accept the stored OTP or standard demo code '123456'
  const isMatch = storedOtp ? cleanCode === storedOtp : cleanCode === '123456';
  if (!isMatch && cleanCode !== '123456') {
    throw new Error('Invalid verification code. Please check and try again.');
  }

  const mockUser = createMockUser({
    uid: 'mock-user-' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'),
    email: cleanEmail,
    displayName: cleanEmail.split('@')[0],
  });

  mockOtpStore.delete(cleanEmail);
  notifySubscribers(mockUser);
  return mockUser;
}

export function getCurrentUser(): User | null {
  if (isFirebaseConfigured && auth && auth.currentUser) {
    return auth.currentUser;
  }
  return mockCurrentUser;
}

export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  authSubscribers.add(callback);
  callback(getCurrentUser());

  let unsubscribeFirebase = () => {};
  if (isFirebaseConfigured && auth) {
    unsubscribeFirebase = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        notifySubscribers(fbUser);
      } else {
        // Guests get an anonymous Firebase account so security rules can tell voters apart.
        if (isSignInWithEmailLink(auth!, window.location.href)) return; // completeEmailLinkSignIn handles it
        signInAnonymously(auth!).catch((err) =>
          console.warn('[Auth] Anonymous sign-in failed:', err)
        );
      }
    });
  }

  return () => {
    authSubscribers.delete(callback);
    unsubscribeFirebase();
  };
}

export async function signOutUser(): Promise<void> {
  if (isFirebaseConfigured && auth) {
    await fbSignOut(auth);
  }
  notifySubscribers(null);
}

// Test / mock inspection helper
export function getStoredOtpForTesting(email: string): string | undefined {
  return mockOtpStore.get(email.trim().toLowerCase());
}

/**
 * Stable per-device id for people who are not signed in, so each guest
 * gets their own votes and host rights instead of sharing one "guest" id.
 */
export function getGuestId(): string {
  const key = 'ideaswipe_guest_id';
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = `guest_${crypto.randomUUID()}`;
    localStorage.setItem(key, id);
    return id;
  } catch {
    return 'guest';
  }
}

const EMAIL_FOR_SIGN_IN_KEY = 'ideaswipe_email_for_sign_in';

/** True when email sign-in sends a real link (Firebase) instead of a demo code. */
export const usesEmailLinkSignIn = isFirebaseConfigured;

/**
 * Finishes email-link sign-in when the page was opened from the emailed link.
 * Links to the current guest account so hosted rooms and votes are kept.
 */
export async function completeEmailLinkSignIn(): Promise<User | null> {
  if (!isFirebaseConfigured || !auth || !isSignInWithEmailLink(auth, window.location.href)) {
    return null;
  }
  await auth.authStateReady();
  const link = window.location.href;
  const email =
    localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY) ||
    window.prompt('Confirm your email to finish signing in') ||
    '';

  // Strip the one-time sign-in params but keep the room code.
  const url = new URL(link);
  ['apiKey', 'oobCode', 'mode', 'lang', 'continueUrl'].forEach((k) => url.searchParams.delete(k));
  window.history.replaceState(null, '', url.toString());

  if (!email) {
    if (!auth.currentUser) await signInAnonymously(auth);
    return null;
  }
  const credential = EmailAuthProvider.credentialWithLink(email, link);
  let user: User;
  if (auth.currentUser?.isAnonymous) {
    try {
      user = (await linkWithCredential(auth.currentUser, credential)).user;
    } catch (err: any) {
      if (err?.code !== 'auth/email-already-in-use' && err?.code !== 'auth/credential-already-in-use') throw err;
      user = (await signInWithEmailLink(auth, email, link)).user;
    }
  } else {
    user = (await signInWithEmailLink(auth, email, link)).user;
  }
  localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
  notifySubscribers(user);
  return user;
}
