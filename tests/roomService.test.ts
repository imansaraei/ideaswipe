import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  extractDocIdFromUrl,
  createRoom,
  getRoom,
  getRoomIdeas,
  syncGoogleDoc,
  toggleIdeaStatus,
  recordSwipe,
  shuffleRoom,
  resetMockRoomStoreForTesting,
  GOOGLE_DOC_MARKDOWN_TEMPLATE,
} from '../src/services/roomService';
import { CreateRoomModal } from '../src/components/CreateRoomModal';
import { GoogleDocImportModal } from '../src/components/GoogleDocImportModal';
import { HostDashboard } from '../src/components/HostDashboard';
import { Room, Idea } from '../src/types';

describe('extractDocIdFromUrl', () => {
  it('extracts ID from standard Google Doc URLs', () => {
    const url = 'https://docs.google.com/document/d/1-HzWk1wHnjp_3RETtdaNX7MoXuGv5XEzp223WfvIlFE/edit';
    expect(extractDocIdFromUrl(url)).toBe('1-HzWk1wHnjp_3RETtdaNX7MoXuGv5XEzp223WfvIlFE');
  });

  it('accepts raw Doc ID directly', () => {
    const id = '1-HzWk1wHnjp_3RETtdaNX7MoXuGv5XEzp223WfvIlFE';
    expect(extractDocIdFromUrl(id)).toBe(id);
  });

  it('extracts ID from URLs with sharing query parameters', () => {
    const url = 'https://docs.google.com/document/d/doc_abc_123_xyz/preview?usp=sharing&tab=t.0';
    expect(extractDocIdFromUrl(url)).toBe('doc_abc_123_xyz');
  });

  it('handles empty or malformed inputs cleanly', () => {
    expect(extractDocIdFromUrl('')).toBe('');
    expect(extractDocIdFromUrl('   ')).toBe('');
  });
});

describe('roomService (Offline / Mock Fallback)', () => {
  beforeEach(() => {
    resetMockRoomStoreForTesting();
    vi.restoreAllMocks();
  });

  it('creates a room with 6-character room code and default limit 3', async () => {
    const room = await createRoom('host_123', 'Friday Night Brainstorm');

    expect(room).toBeDefined();
    expect(room.id).toBeDefined();
    expect(room.code).toHaveLength(6);
    expect(room.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(room.name).toBe('Friday Night Brainstorm');
    expect(room.hostUserId).toBe('host_123');
    expect(room.leaderboardLimit).toBe(3);
    expect(room.activeIdeaIds).toEqual([]);
    expect(room.createdAt).toBeGreaterThan(0);
  });

  it('creates a room with custom limit and schedule', async () => {
    const schedule = {
      enabled: true,
      time: '19:00',
      timezone: 'America/New_York',
      daysOfWeek: [1, 3, 5],
    };
    const room = await createRoom('host_456', 'Design Sprint', 5, schedule);

    expect(room.leaderboardLimit).toBe(5);
    expect(room.schedule).toEqual(schedule);
  });

  it('retrieves a room by ID or by room code', async () => {
    const created = await createRoom('host_789', 'Startup Pitch Deck');
    const byId = await getRoom(created.id);
    const byCode = await getRoom(created.code);

    expect(byId).toEqual(created);
    expect(byCode).toEqual(created);
    expect(await getRoom('non-existent')).toBeNull();
  });

  it('syncs Google Doc content and saves ideas to the room', async () => {
    const room = await createRoom('host_123', 'Doc Sync Test');
    const sampleMarkdown = `
### ★ I-001 VR Coffee Shop
- Status: pot
- Idea: Virtual reality cafe to meet remote coworkers with spatial audio.
- Category: Social
- Problem: Remote isolation and lack of casual serendipitous watercooler talk.
- Next step: Build a WebXR prototype room.

### ★ I-002 Smart Plant Monitor
- Status: pot
- Idea: Low-power Bluetooth soil sensor with cheeky personality notifications.
- Category: Hardware
- Problem: People forget to water houseplants until they wither.
- Next step: Breadboard test with Arduino.
    `.trim();

    const count = await syncGoogleDoc(room.id, '1-HzWk1wHnjp_3RETtdaNX7MoXuGv5XEzp223WfvIlFE', sampleMarkdown);
    expect(count).toBe(2);

    const ideas = await getRoomIdeas(room.id);
    expect(ideas).toHaveLength(2);
    expect(ideas[0].code).toBe('I-001');
    expect(ideas[0].status).toBe('pot');
    expect(ideas[1].code).toBe('I-002');

    const updatedRoom = await getRoom(room.id);
    expect(updatedRoom?.googleDoc?.docId).toBe('1-HzWk1wHnjp_3RETtdaNX7MoXuGv5XEzp223WfvIlFE');
    expect(updatedRoom?.googleDoc?.lastSyncedAt).toBeGreaterThan(0);
  });

  it('fetches Google Doc export URL when directContent is not provided', async () => {
    const room = await createRoom('host_123', 'Fetch Test');
    const docId = 'mock_doc_id_999';
    const fakeDocText = `
### ★ I-010 AI Recipe Generator
- Status: pot
- Idea: Generates recipes from fridge photos.
- Category: Food
    `.trim();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => fakeDocText,
    });
    vi.stubGlobal('fetch', fetchMock);

    const count = await syncGoogleDoc(room.id, docId);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://docs.google.com/document/d/${docId}/export?format=txt`
    );
    expect(count).toBe(1);

    const ideas = await getRoomIdeas(room.id);
    expect(ideas[0].code).toBe('I-010');
  });

  it('toggles an idea status between pot and archived', async () => {
    const room = await createRoom('host_123', 'Toggle Test');
    const sample = `
### ★ I-001 Idea One
- Status: pot
- Idea: First idea.
    `.trim();

    await syncGoogleDoc(room.id, 'doc1', sample);
    const ideas = await getRoomIdeas(room.id);
    const ideaId = ideas[0].id;

    // Archive it
    await toggleIdeaStatus(room.id, ideaId, 'archived');
    let currentIdeas = await getRoomIdeas(room.id);
    expect(currentIdeas.find((i) => i.id === ideaId)?.status).toBe('archived');

    // Move back to pot
    await toggleIdeaStatus(room.id, ideaId, 'pot');
    currentIdeas = await getRoomIdeas(room.id);
    expect(currentIdeas.find((i) => i.id === ideaId)?.status).toBe('pot');
  });
});

describe('CreateRoomModal Component', () => {
  it('renders modal with default values when open', () => {
    render(
      React.createElement(CreateRoomModal, {
        isOpen: true,
        onClose: vi.fn(),
        hostUserId: 'host_test_user',
      })
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/create new room/i)).toBeDefined();
    expect(screen.getByLabelText(/room name/i)).toBeDefined();
    expect(screen.getByLabelText(/leaderboard limit/i)).toBeDefined();
  });

  it('submits form and calls onRoomCreated callback with new room', async () => {
    const handleCreated = vi.fn();
    const handleClose = vi.fn();

    render(
      React.createElement(CreateRoomModal, {
        isOpen: true,
        onClose: handleClose,
        onRoomCreated: handleCreated,
        hostUserId: 'user_host_1',
      })
    );

    fireEvent.change(screen.getByLabelText(/room name/i), {
      target: { value: 'Awesome Product Room' },
    });
    fireEvent.change(screen.getByLabelText(/leaderboard limit/i), {
      target: { value: '5' },
    });

    const submitBtn = screen.getByRole('button', { name: /create room/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleCreated).toHaveBeenCalled();
      const createdRoom = handleCreated.mock.calls[0][0];
      expect(createdRoom.name).toBe('Awesome Product Room');
      expect(createdRoom.leaderboardLimit).toBe(5);
      expect(handleClose).toHaveBeenCalled();
    });
  });
});

describe('GoogleDocImportModal Component', () => {
  it('renders and allows copying the markdown template', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(
      React.createElement(GoogleDocImportModal, {
        isOpen: true,
        onClose: vi.fn(),
        roomId: 'room_test_1',
      })
    );

    expect(screen.getByText(/sync with google doc/i)).toBeDefined();
    const copyBtn = screen.getByRole('button', { name: /copy template/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(GOOGLE_DOC_MARKDOWN_TEMPLATE);
      expect(screen.getByText(/copied/i)).toBeDefined();
    });
  });

  it('triggers sync on submitting a Google Doc URL', async () => {
    const handleSynced = vi.fn();
    const handleClose = vi.fn();

    // Create room first in mock store
    const room = await createRoom('host_1', 'Modal Sync Room');

    // Stub fetch
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
### ★ I-005 Auto Transcriber
- Status: pot
- Idea: Speech to text helper.
      `.trim(),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      React.createElement(GoogleDocImportModal, {
        isOpen: true,
        onClose: handleClose,
        onSynced: handleSynced,
        roomId: room.id,
      })
    );

    const input = screen.getByPlaceholderText(/docs\.google\.com/i);
    fireEvent.change(input, {
      target: {
        value: 'https://docs.google.com/document/d/1234567890abcdef/edit',
      },
    });

    const syncBtn = screen.getByRole('button', { name: /sync now/i });
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(handleSynced).toHaveBeenCalledWith(1);
      expect(handleClose).toHaveBeenCalled();
    });
  });
});

describe('HostDashboard Component', () => {
  const mockRoom: Room = {
    id: 'room_host_dash',
    code: 'SWP888',
    name: 'Hackathon Ideation',
    hostUserId: 'host_owner',
    leaderboardLimit: 3,
    activeIdeaIds: ['i-001'],
    createdAt: Date.now(),
  };

  const mockIdeas: Idea[] = [
    {
      id: 'i-001',
      code: 'I-001',
      title: 'I-001: Autonomous Lawn Mower',
      oneLiner: 'Solar powered quiet lawn mower.',
      category: 'Robotics',
      status: 'active',
      likesCount: 5,
      passesCount: 1,
      score: 83,
    },
    {
      id: 'i-002',
      code: 'I-002',
      title: 'I-002: Smart Mirror',
      oneLiner: 'Morning weather and commute briefing in bathroom mirror.',
      category: 'IoT',
      status: 'pot',
      likesCount: 2,
      passesCount: 2,
      score: 50,
    },
    {
      id: 'i-003',
      code: 'I-003',
      title: 'I-003: Dog Whistle App',
      oneLiner: 'High frequency sounds for training dogs.',
      category: 'Mobile',
      status: 'archived',
      likesCount: 0,
      passesCount: 4,
      score: 0,
    },
  ];

  it('renders room code in tabular monospace and shows ideas by status tab', () => {
    render(
      React.createElement(HostDashboard, {
        room: mockRoom,
        initialIdeas: mockIdeas,
        onOpenDocSync: vi.fn(),
      })
    );

    expect(screen.getByText('Hackathon Ideation')).toBeDefined();
    // Tabular monospace code
    const codeElem = screen.getByText('SWP888');
    expect(codeElem.className).toContain('font-mono-tabular');

    // Stats
    expect(screen.getByText(/1 Active/i)).toBeDefined();
    expect(screen.getByText(/1 in Pot/i)).toBeDefined();
    expect(screen.getByText(/1 Archived/i)).toBeDefined();

    // Default view shows Pot tab
    expect(screen.getByText('Smart Mirror')).toBeDefined();
  });

  it('allows switching tabs and toggling status between pot and archived', async () => {
    const handleToggle = vi.fn();

    render(
      React.createElement(HostDashboard, {
        room: mockRoom,
        initialIdeas: mockIdeas,
        onToggleStatus: handleToggle,
      })
    );

    // Click "Archive" button on the pot idea
    const archiveBtn = screen.getByRole('button', { name: /archive smart mirror/i });
    fireEvent.click(archiveBtn);

    expect(handleToggle).toHaveBeenCalledWith('i-002', 'archived');

    // Switch to Archived tab
    const archivedTab = screen.getByRole('tab', { name: /archived/i });
    fireEvent.click(archivedTab);

    // Idea 3 should now be visible
    expect(screen.getByText('Dog Whistle App')).toBeDefined();
    const restoreBtn = screen.getByRole('button', { name: /move dog whistle app to pot/i });
    fireEvent.click(restoreBtn);

    expect(handleToggle).toHaveBeenCalledWith('i-003', 'pot');
  });

  it('renders Shuffle button and triggers shuffleRoom with toast feedback', async () => {
    const room = await createRoom('host_owner', 'Shuffle Host Test Room', 2);
    const docSample = `
### ★ I-001 First Idea
- Status: pot
- Idea: First description.

### ★ I-002 Second Idea
- Status: pot
- Idea: Second description.
    `.trim();

    await syncGoogleDoc(room.id, 'doc1', docSample);

    render(
      React.createElement(HostDashboard, {
        room,
        onRoomUpdated: vi.fn(),
      })
    );

    const shuffleBtn = screen.getByRole('button', { name: /shuffle pot \/ start round/i });
    expect(shuffleBtn).toBeDefined();

    fireEvent.click(shuffleBtn);

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeDefined();
      expect(screen.getByText(/round started/i)).toBeDefined();
    });
  });
});

describe('Vote Preservation in syncGoogleDoc', () => {
  beforeEach(() => {
    resetMockRoomStoreForTesting();
    vi.restoreAllMocks();
  });

  it('preserves likesCount, passesCount, and score when doc is re-synced', async () => {
    const room = await createRoom('host_1', 'Vote Preservation Room');
    const doc1 = `
### ★ I-001 VR Workspace
- Status: pot
- Idea: Virtual reality collaboration space.
    `.trim();

    await syncGoogleDoc(room.id, 'doc1', doc1);
    const ideasBefore = await getRoomIdeas(room.id);
    const ideaId = ideasBefore[0].id;

    // Record some votes
    await recordSwipe(room.id, 'user_1', ideaId, 'like');
    await recordSwipe(room.id, 'user_2', ideaId, 'pass');

    const ideasAfterVote = await getRoomIdeas(room.id);
    expect(ideasAfterVote[0].likesCount).toBe(1);
    expect(ideasAfterVote[0].passesCount).toBe(1);
    expect(ideasAfterVote[0].score).toBe(0.5);

    // Re-sync with updated description
    const doc2 = `
### ★ I-001 VR Workspace
- Status: pot
- Idea: Virtual reality collaboration space with spatial audio and avatars.
    `.trim();

    await syncGoogleDoc(room.id, 'doc1', doc2);
    const ideasAfterResync = await getRoomIdeas(room.id);

    expect(ideasAfterResync[0].oneLiner).toBe(
      'Virtual reality collaboration space with spatial audio and avatars.'
    );
    // Votes and score are preserved!
    expect(ideasAfterResync[0].likesCount).toBe(1);
    expect(ideasAfterResync[0].passesCount).toBe(1);
    expect(ideasAfterResync[0].score).toBe(0.5);
  });

  it('sets status to archived when doc explicitly specifies - Status: dropped', async () => {
    const room = await createRoom('host_1', 'Drop Status Room');
    const doc1 = `
### ★ I-001 Active Project
- Status: pot
- Idea: Some cool project.
    `.trim();

    await syncGoogleDoc(room.id, 'doc1', doc1);
    const ideas = await getRoomIdeas(room.id);
    expect(ideas[0].status).toBe('pot');

    // Re-sync with dropped status
    const doc2 = `
### ★ I-001 Active Project
- Status: dropped
- Idea: Some cool project.
    `.trim();

    await syncGoogleDoc(room.id, 'doc1', doc2);
    const ideasAfter = await getRoomIdeas(room.id);
    expect(ideasAfter[0].status).toBe('archived');
  });
});

describe('Double-Vote Prevention in recordSwipe', () => {
  beforeEach(() => {
    resetMockRoomStoreForTesting();
    vi.restoreAllMocks();
  });

  it('does not increment likesCount or passesCount if user already swiped on the idea', async () => {
    const room = await createRoom('host_1', 'Double Vote Room');
    const doc = `
### ★ I-001 Drone Delivery
- Status: pot
- Idea: Drone delivery for medicine.
    `.trim();

    await syncGoogleDoc(room.id, 'doc1', doc);
    const ideas = await getRoomIdeas(room.id);
    expect(ideas).toHaveLength(1);
    const ideaId = ideas[0].id;

    // First swipe
    const swipe1 = await recordSwipe(room.id, 'voter_A', ideaId, 'like');
    expect(swipe1).toBeDefined();

    let currentIdeas = await getRoomIdeas(room.id);
    expect(currentIdeas[0].likesCount).toBe(1);
    expect(currentIdeas[0].passesCount).toBe(0);

    // Duplicate swipe by voter_A
    const swipe2 = await recordSwipe(room.id, 'voter_A', ideaId, 'like');
    expect(swipe2.id).toBe(swipe1.id);

    currentIdeas = await getRoomIdeas(room.id);
    expect(currentIdeas[0].likesCount).toBe(1); // Not incremented!
    expect(currentIdeas[0].passesCount).toBe(0);
  });
});

describe('shuffleRoom Service', () => {
  beforeEach(() => {
    resetMockRoomStoreForTesting();
    vi.restoreAllMocks();
  });

  it('promotes winning challengers, dethrones lower champions, and selects next challengers', async () => {
    const room = await createRoom('host_1', 'KOTH Shuffle Arena', 2);
    const doc = `
### ★ I-001 Champ Idea
- Status: pot
- Idea: Idea 1.

### ★ I-002 Challenger Idea
- Status: pot
- Idea: Idea 2.

### ★ I-003 Waiting Idea
- Status: pot
- Idea: Idea 3.
    `.trim();

    await syncGoogleDoc(room.id, 'doc1', doc);
    const ideas = await getRoomIdeas(room.id);
    expect(ideas).toHaveLength(3);

    // First shuffle: picks first 2 challengers
    const shuffle1 = await shuffleRoom(room.id);
    expect(shuffle1.nextChallengers).toHaveLength(2);
    expect(shuffle1.activeIdeaIds).toEqual(['i-001', 'i-002']);

    const updatedRoom1 = await getRoom(room.id);
    expect(updatedRoom1?.activeIdeaIds).toEqual(['i-001', 'i-002']);
    expect(updatedRoom1?.lastShuffledAt).toBeGreaterThan(0);

    // Cast votes: I-001 gets 100% likes, I-002 gets 0% likes
    await recordSwipe(room.id, 'user_1', 'i-001', 'like');
    await recordSwipe(room.id, 'user_1', 'i-002', 'pass');

    // Second shuffle: evaluates I-001 and I-002, I-001 becomes champ, I-002 goes back to pot
    const shuffle2 = await shuffleRoom(room.id);
    expect(shuffle2.champions.map((c) => c.id)).toContain('i-001');

    const ideasAfterShuffle = await getRoomIdeas(room.id);
    const champ = ideasAfterShuffle.find((i) => i.id === 'i-001');
    expect(champ?.status).toBe('active');

    // Next challengers picked from available pot (I-003 and I-002)
    expect(shuffle2.nextChallengers.length).toBeGreaterThan(0);
  });
});
