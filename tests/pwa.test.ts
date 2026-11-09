import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import manifest from '../public/manifest.json';
import {
  requestNotificationPermission,
  getNotificationPermission,
  saveTokenToUserProfile,
  registerServiceWorker,
  resetMockNotificationStoreForTesting,
  getMockUserTokensForTesting,
} from '../src/services/notifications';
import { App } from '../src/App';

describe('PWA Manifest', () => {
  it('defines standalone display and theme color #030705', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#030705');
    expect(manifest.background_color).toBe('#030705');
  });

  it('defines name, short_name, orientation and icons', () => {
    expect(manifest.name).toBe('IdeaSwipe');
    expect(manifest.short_name).toBe('IdeaSwipe');
    expect(manifest.orientation).toBe('portrait-primary');
    expect(manifest.icons).toBeDefined();
    expect(Array.isArray(manifest.icons)).toBe(true);

    const iconSizes = manifest.icons.map((icon: any) => icon.sizes);
    expect(iconSizes).toContain('192x192');
    expect(iconSizes).toContain('512x512');
  });
});

describe('Web Push Notification Service', () => {
  beforeEach(() => {
    resetMockNotificationStoreForTesting();
    vi.restoreAllMocks();
  });

  it('handles unsupported Notification API gracefully', async () => {
    const originalNotification = window.Notification;
    // @ts-expect-error test override
    delete window.Notification;

    const permission = getNotificationPermission();
    expect(permission).toBe('unsupported');

    const token = await requestNotificationPermission('user-123');
    expect(token).toBeNull();

    window.Notification = originalNotification;
  });

  it('gracefully handles denied permission without throwing error', async () => {
    vi.stubGlobal('Notification', {
      permission: 'denied',
      requestPermission: vi.fn().mockResolvedValue('denied'),
    });

    const token = await requestNotificationPermission('user-123');
    expect(token).toBeNull();
  });

  it('returns token and saves to user profile when permission is granted', async () => {
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });

    const token = await requestNotificationPermission('user-123');
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');

    const tokens = getMockUserTokensForTesting('user-123');
    expect(tokens).toContain(token);
  });

  it('registers token to user profile without duplicates', async () => {
    await saveTokenToUserProfile('user-456', 'token-abc');
    await saveTokenToUserProfile('user-456', 'token-abc');
    await saveTokenToUserProfile('user-456', 'token-def');

    const tokens = getMockUserTokensForTesting('user-456');
    expect(tokens).toHaveLength(2);
    expect(tokens).toEqual(['token-abc', 'token-def']);
  });

  it('registers service worker when supported', async () => {
    const mockRegister = vi.fn().mockResolvedValue({ scope: '/' });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: mockRegister },
      configurable: true,
    });

    const reg = await registerServiceWorker();
    expect(mockRegister).toHaveBeenCalledWith('/firebase-messaging-sw.js', { scope: '/' });
    expect(reg).toEqual({ scope: '/' });
  });
});

describe('App PWA & Notification Integration', () => {
  beforeEach(() => {
    resetMockNotificationStoreForTesting();
    vi.restoreAllMocks();
  });

  it('renders notification toggle button in header', () => {
    render(React.createElement(App));
    const notifyBtn = screen.getByRole('button', { name: /notification/i });
    expect(notifyBtn).toBeDefined();
  });

  it('clicking notification button triggers permission request', async () => {
    const requestSpy = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: requestSpy,
    });

    render(React.createElement(App));
    const notifyBtn = screen.getByRole('button', { name: /notification/i });
    fireEvent.click(notifyBtn);

    await waitFor(() => {
      expect(requestSpy).toHaveBeenCalled();
    });
  });

  it('renders install banner on beforeinstallprompt event and handles install click', async () => {
    render(React.createElement(App));

    const promptSpy = vi.fn();
    const beforeInstallEvent = new Event('beforeinstallprompt') as any;
    beforeInstallEvent.prompt = promptSpy;
    beforeInstallEvent.userChoice = Promise.resolve({ outcome: 'accepted' });

    fireEvent(window, beforeInstallEvent);

    const installBtn = await screen.findByRole('button', { name: /install/i });
    expect(installBtn).toBeDefined();

    fireEvent.click(installBtn);
    expect(promptSpy).toHaveBeenCalled();
  });
});
