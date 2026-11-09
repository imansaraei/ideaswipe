import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  generateRoomCode,
  signInWithGoogle,
  requestEmailOtp,
  verifyEmailOtp,
  signOutUser,
  onAuthStateChange,
  getCurrentUser,
  getStoredOtpForTesting,
} from '../src/services/auth';
import { AuthModal } from '../src/components/AuthModal';

describe('generateRoomCode', () => {
  it('produces a 6-character uppercase alphanumeric code', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('generates distinct codes across calls', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add(generateRoomCode());
    }
    // High probability all 20 random 6-char alphanumeric codes are distinct
    expect(codes.size).toBeGreaterThan(15);
  });
});

describe('Firebase Auth Service (Offline / Mock Fallback)', () => {
  beforeEach(async () => {
    await signOutUser();
  });

  it('signs in with Google and returns a user with uid and email', async () => {
    const user = await signInWithGoogle();
    expect(user).toBeDefined();
    expect(user.uid).toMatch(/^mock-google-user/);
    expect(user.email).toBeDefined();
    expect(getCurrentUser()?.uid).toBe(user.uid);
  });

  it('rejects invalid email formats when requesting OTP', async () => {
    await expect(requestEmailOtp('')).rejects.toThrow('Email address is required');
    await expect(requestEmailOtp('not-an-email')).rejects.toThrow('Please enter a valid email address');
  });

  it('generates an OTP for a valid email', async () => {
    const testEmail = 'alex@example.com';
    await requestEmailOtp(testEmail);
    const otp = getStoredOtpForTesting(testEmail);
    expect(otp).toBeDefined();
    expect(otp).toHaveLength(6);
    expect(otp).toMatch(/^\d{6}$/);
  });

  it('rejects invalid or non-6-digit verification codes', async () => {
    const testEmail = 'beta@example.com';
    await requestEmailOtp(testEmail);
    await expect(verifyEmailOtp(testEmail, '123')).rejects.toThrow('Verification code must be 6 digits');
    await expect(verifyEmailOtp(testEmail, 'abcdef')).rejects.toThrow('Verification code must be 6 digits');
    await expect(verifyEmailOtp(testEmail, '999999')).rejects.toThrow('Invalid verification code');
  });

  it('verifies valid OTP and returns a signed-in user', async () => {
    const testEmail = 'consensus@ideaswipe.io';
    await requestEmailOtp(testEmail);
    const otp = getStoredOtpForTesting(testEmail)!;
    const user = await verifyEmailOtp(testEmail, otp);

    expect(user).toBeDefined();
    expect(user.email).toBe(testEmail);
    expect(getCurrentUser()?.email).toBe(testEmail);
  });

  it('also accepts demo verification code 123456 as universal test code', async () => {
    const testEmail = 'demo@ideaswipe.io';
    const user = await verifyEmailOtp(testEmail, '123456');
    expect(user.email).toBe(testEmail);
  });

  it('notifies subscribers on auth state change and signOut', async () => {
    const states: (string | null)[] = [];
    const unsubscribe = onAuthStateChange((user) => {
      states.push(user ? user.email : null);
    });

    await signInWithGoogle();
    await signOutUser();

    expect(states).toContain(null);
    expect(states.some((email) => email && email.includes('@'))).toBe(true);
    unsubscribe();
  });
});

describe('AuthModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      React.createElement(AuthModal, { isOpen: false, onClose: vi.fn() })
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders with Abyssal Jade styling and title when isOpen is true', () => {
    render(
      React.createElement(AuthModal, {
        isOpen: true,
        onClose: vi.fn(),
        title: 'Test Sign In',
      })
    );
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Test Sign In')).toBeDefined();
    expect(screen.getByText('Continue with Google')).toBeDefined();
    expect(screen.getByLabelText(/email address/i)).toBeDefined();
  });

  it('triggers Google sign in and calls onSuccess and onClose', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      React.createElement(AuthModal, {
        isOpen: true,
        onClose: handleClose,
        onSuccess: handleSuccess,
      })
    );

    const googleBtn = screen.getByText('Continue with Google');
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('handles the email OTP flow and transitions between steps', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      React.createElement(AuthModal, {
        isOpen: true,
        onClose: handleClose,
        onSuccess: handleSuccess,
      })
    );

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'swipemaster@example.com' } });

    const sendBtn = screen.getByText('Send 6-Digit Code');
    fireEvent.click(sendBtn);

    // Transitions to OTP step
    await waitFor(() => {
      expect(screen.getByLabelText(/verification code/i)).toBeDefined();
      expect(screen.getByText(/swipemaster@example.com/i)).toBeDefined();
    });

    // Enter 6-digit code
    const otpInput = screen.getByLabelText(/verification code/i);
    fireEvent.change(otpInput, { target: { value: '123456' } });

    const verifyBtn = screen.getByText('Verify & Sign In');
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('allows user to navigate back to email step from OTP step', async () => {
    render(
      React.createElement(AuthModal, {
        isOpen: true,
        onClose: vi.fn(),
      })
    );

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'back@example.com' } });
    fireEvent.click(screen.getByText('Send 6-Digit Code'));

    await waitFor(() => {
      expect(screen.getByText(/change email/i)).toBeDefined();
    });

    fireEvent.click(screen.getByText(/change email/i));

    await waitFor(() => {
      expect(screen.getByText('Continue with Google')).toBeDefined();
      expect(screen.getByLabelText(/email address/i)).toBeDefined();
    });
  });

  it('closes when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      React.createElement(AuthModal, {
        isOpen: true,
        onClose: handleClose,
      })
    );

    const closeBtn = screen.getByLabelText('Close modal');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
