import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../src/App';
import {
  createRoom,
  syncGoogleDoc,
  resetMockRoomStoreForTesting,
} from '../src/services/roomService';
import { resetMockNotificationStoreForTesting } from '../src/services/notifications';
import { signOutUser } from '../src/services/auth';

describe('App Component Navigation & Lifecycle', () => {
  beforeEach(async () => {
    resetMockRoomStoreForTesting();
    resetMockNotificationStoreForTesting();
    await signOutUser();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('renders JoinRoomScreen with create room button when no room is selected', () => {
    render(React.createElement(App));

    expect(screen.getByTestId('join-room-screen')).toBeDefined();
    expect(screen.getByText('Join Idea Room')).toBeDefined();
    expect(screen.getByRole('button', { name: /create new room/i })).toBeDefined();
  });

  it('opens CreateRoomModal when Create a New Room button is clicked', async () => {
    render(React.createElement(App));

    const createBtn = screen.getByRole('button', { name: /create new room/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText(/create new room/i)).toBeDefined();
    });
  });

  it('opens AuthModal when Sign In button is clicked', async () => {
    render(React.createElement(App));

    const signInBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(signInBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText(/join the consensus/i)).toBeDefined();
    });
  });

  it('loads room automatically when URL contains ?code=... param', async () => {
    const room = await createRoom('host_123', 'URL Code Room');
    window.history.pushState({}, '', `/?code=${room.code}`);

    render(React.createElement(App));

    await waitFor(() => {
      expect(screen.getByText(`ROOM: ${room.code}`)).toBeDefined();
      expect(screen.getByRole('button', { name: /swipe deck/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /leaderboard/i })).toBeDefined();
    });
  });

  it('copies room code when room code badge is clicked', async () => {
    const room = await createRoom('host_123', 'Copy Room Test');
    window.history.pushState({}, '', `/?code=${room.code}`);

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(React.createElement(App));

    const codeBadge = await screen.findByRole('button', {
      name: new RegExp(`copy room code ${room.code}`, 'i'),
    });
    fireEvent.click(codeBadge);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(room.code);
    });
  });

  it('switches between Deck and Rankings tabs smoothly', async () => {
    const room = await createRoom('host_123', 'Tab Switching Room');
    const docSample = `
### ★ I-001 Mobile App
- Status: pot
- Idea: Flutter application.

### ★ I-002 Web Portal
- Status: pot
- Idea: React application.
    `.trim();

    await syncGoogleDoc(room.id, 'doc1', docSample);
    window.history.pushState({}, '', `/?code=${room.code}`);

    render(React.createElement(App));

    // Initially in Deck view
    await screen.findByTestId('swipe-deck');
    expect(screen.getByText(/Mobile App/i)).toBeDefined();

    // Switch to Rankings
    const rankingsTab = screen.getByRole('button', { name: /leaderboard/i });
    fireEvent.click(rankingsTab);

    await screen.findByTestId('leaderboard-view');
    expect(screen.getByText('KING OF THE HILL')).toBeDefined();

    // Switch back to Deck
    const deckTab = screen.getByRole('button', { name: /swipe deck/i });
    fireEvent.click(deckTab);

    await screen.findByTestId('swipe-deck');
  });

  it('allows leaving the room via Leave Room button', async () => {
    const room = await createRoom('host_123', 'Leave Room Test');
    window.history.pushState({}, '', `/?code=${room.code}`);

    render(React.createElement(App));

    await screen.findByText(`ROOM: ${room.code}`);

    const leaveBtn = screen.getByRole('button', { name: /leave room/i });
    fireEvent.click(leaveBtn);

    await screen.findByTestId('join-room-screen');
  });
});
