import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInWithGoogle, getUserRole } from './authService';
import { signInWithPopup } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';
import { ALLOWED_DOMAIN } from '../utils/constants';

vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: {
    credentialFromResult: vi.fn(() => ({ accessToken: 'mock-token' }))
  }
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  initializeFirestore: vi.fn(),
  persistentLocalCache: vi.fn()
}));

vi.mock('./firebase', () => ({
  auth: {},
  db: {},
  googleProvider: {}
}));

describe('Auth Service Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw an error if the user logs in with an invalid domain', async () => {
    signInWithPopup.mockResolvedValue({
      user: {
        uid: '123',
        email: 'hacker@evil.com'
      }
    });

    await expect(signInWithGoogle()).rejects.toThrow(`Access denied. Only @${ALLOWED_DOMAIN} accounts are allowed.`);
  });

  it('should authenticate correctly for a valid domain', async () => {
    signInWithPopup.mockResolvedValue({
      user: {
        uid: '123',
        email: `user@${ALLOWED_DOMAIN}`,
        displayName: 'Test User'
      }
    });
    
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ role: 'user' })
    });

    const result = await signInWithGoogle();
    expect(result.role).toBe('user');
    expect(result.user.email).toBe(`user@${ALLOWED_DOMAIN}`);
  });

  it('getUserRole should return admin for fallback admin emails', async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    // Assuming 'disitha@scot.lk' is a fallback admin
    const role = await getUserRole('123', 'disitha@scot.lk');
    expect(role).toBe('admin');
  });
});
