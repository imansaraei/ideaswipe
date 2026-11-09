import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
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

  // Generate 6-digit numeric OTP
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
  if (isFirebaseConfigured && auth) {
    return auth.currentUser;
  }
  return mockCurrentUser;
}

export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  if (isFirebaseConfigured && auth) {
    return onAuthStateChanged(auth, callback);
  }

  authSubscribers.add(callback);
  callback(mockCurrentUser);
  return () => {
    authSubscribers.delete(callback);
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
