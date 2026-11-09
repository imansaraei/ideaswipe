import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pickNextChallengers, executeRoomShuffle, isRoomDueForShuffle } from '../src/shuffle';
import { sendBatchNotification } from '../src/notifications';
import { Idea, Room } from '../../src/types';

describe('pickNextChallengers', () => {
  it('selects exactly N unvoted ideas from pot', () => {
    const pot = [
      { id: '1', status: 'pot' },
      { id: '2', status: 'pot' },
      { id: '3', status: 'pot' },
      { id: '4', status: 'pot' },
    ] as any;

    const selected = pickNextChallengers(pot, 3);
    expect(selected).toHaveLength(3);
    expect(selected.every((s) => s.status === 'pot')).toBe(true);
  });

  it('serves all available ideas safely when pot has fewer than N ideas', () => {
    const pot = [
      { id: '1', status: 'pot' },
      { id: '2', status: 'pot' },
    ] as any;

    const selected = pickNextChallengers(pot, 5);
    expect(selected).toHaveLength(2);
    expect(selected.map((s) => s.id)).toEqual(['1', '2']);
  });

  it('handles empty pot safely without throwing or looping', () => {
    const selected = pickNextChallengers([], 3);
    expect(selected).toEqual([]);
  });

  it('handles count <= 0 gracefully', () => {
    const pot = [{ id: '1', status: 'pot' }] as any;
    expect(pickNextChallengers(pot, 0)).toEqual([]);
    expect(pickNextChallengers(pot, -1)).toEqual([]);
  });

  it('prioritizes unvoted pot ideas over previously voted/dethroned ideas', () => {
    const pot = [
      { id: 'voted-1', status: 'pot', likesCount: 2, passesCount: 2 },
      { id: 'unvoted-1', status: 'pot', likesCount: 0, passesCount: 0 },
      { id: 'unvoted-2', status: 'pot' },
    ] as any;

    const selected = pickNextChallengers(pot, 2);
    expect(selected.map((s) => s.id)).toEqual(['unvoted-1', 'unvoted-2']);
  });
});

describe('sendBatchNotification', () => {
  it('filters empty, whitespace-only, or invalid tokens gracefully', async () => {
    const mockSendEach = vi.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    });

    const mockMessaging = {
      sendEachForMulticast: mockSendEach,
    };

    const result = await sendBatchNotification(
      ['', '   ', null as any, 'valid-token-123'],
      'Beta Launch Room',
      3,
      'SWP888',
      mockMessaging as any
    );

    expect(result.successCount).toBe(1);
    expect(mockSendEach).toHaveBeenCalledTimes(1);
    const callArg = mockSendEach.mock.calls[0][0];
    expect(callArg.tokens).toEqual(['valid-token-123']);
    expect(callArg.notification.title).toBe('IdeaSwipe: New batch in Beta Launch Room');
    expect(callArg.notification.body).toBe('Your 3 new ideas are ready to swipe today.');
    expect(callArg.data.url).toBe('/join/SWP888');
  });

  it('returns zero counts immediately when token array is empty or all invalid', async () => {
    const mockSendEach = vi.fn();
    const result = await sendBatchNotification(
      ['', '  '],
      'Test Room',
      2,
      'XYZ123',
      { sendEachForMulticast: mockSendEach } as any
    );

    expect(result).toEqual({ successCount: 0, failureCount: 0 });
    expect(mockSendEach).not.toHaveBeenCalled();
  });
});

describe('executeRoomShuffle', () => {
  it('evaluates challengers, updates champions/pot, picks next challengers, updates lastShuffledAt, and triggers notifications', async () => {
    const roomData: Room = {
      id: 'room-1',
      code: 'SWP001',
      name: 'Design Sprint',
      hostUserId: 'user-host',
      leaderboardLimit: 2,
      activeIdeaIds: ['challenger-1', 'challenger-2'],
      createdAt: Date.now() - 100000,
    };

    const ideasData: Idea[] = [
      // Current champions
      {
        id: 'champ-1',
        code: 'I-001',
        title: 'Champ 1',
        oneLiner: 'One',
        category: 'Tech',
        status: 'active',
        likesCount: 5,
        passesCount: 5,
        score: 0.5,
      },
      // Current active challengers
      {
        id: 'challenger-1',
        code: 'I-002',
        title: 'Challenger 1 High',
        oneLiner: 'Two',
        category: 'Tech',
        status: 'active',
        likesCount: 9,
        passesCount: 1,
        score: 0.9,
      },
      {
        id: 'challenger-2',
        code: 'I-003',
        title: 'Challenger 2 Low',
        oneLiner: 'Three',
        category: 'Tech',
        status: 'active',
        likesCount: 2,
        passesCount: 8,
        score: 0.2,
      },
      // Pot ideas for next round
      {
        id: 'pot-1',
        code: 'I-004',
        title: 'Pot Idea 1',
        oneLiner: 'Four',
        category: 'Product',
        status: 'pot',
        likesCount: 0,
        passesCount: 0,
        score: 0,
      },
      {
        id: 'pot-2',
        code: 'I-005',
        title: 'Pot Idea 2',
        oneLiner: 'Five',
        category: 'Product',
        status: 'pot',
        likesCount: 0,
        passesCount: 0,
        score: 0,
      },
      {
        id: 'pot-3',
        code: 'I-006',
        title: 'Pot Idea 3',
        oneLiner: 'Six',
        category: 'Product',
        status: 'pot',
        likesCount: 0,
        passesCount: 0,
        score: 0,
      },
    ];

    const usersData = [
      {
        uid: 'user-host',
        email: 'host@test.com',
        fcmTokens: ['token-host-1'],
        roomsJoined: ['room-1'],
      },
      {
        uid: 'user-member',
        email: 'member@test.com',
        fcmTokens: ['token-member-1'],
        roomsJoined: ['room-1'],
      },
    ];

    const mockUpdates: Record<string, any> = {};

    const mockDb = {
      collection: (colName: string) => {
        if (colName === 'rooms') {
          return {
            doc: (docId: string) => ({
              get: async () => ({
                exists: docId === 'room-1',
                data: () => (docId === 'room-1' ? roomData : undefined),
              }),
              update: async (patch: any) => {
                mockUpdates[`rooms/${docId}`] = patch;
              },
              collection: (subCol: string) => {
                if (subCol === 'ideas') {
                  return {
                    get: async () => ({
                      docs: ideasData.map((idea) => ({
                        id: idea.id,
                        data: () => idea,
                      })),
                    }),
                    doc: (ideaId: string) => ({
                      update: async (patch: any) => {
                        mockUpdates[`ideas/${ideaId}`] = patch;
                      },
                    }),
                  };
                }
                return {};
              },
            }),
          };
        }
        if (colName === 'users') {
          return {
            where: () => ({
              get: async () => ({
                docs: usersData.map((u) => ({
                  id: u.uid,
                  data: () => u,
                })),
              }),
            }),
          };
        }
        return {};
      },
    };

    const mockMessaging = {
      sendEachForMulticast: vi.fn().mockResolvedValue({
        successCount: 2,
        failureCount: 0,
      }),
    };

    const result = await executeRoomShuffle('room-1', mockDb as any, mockMessaging as any);

    // Leaderboard limit is 2.
    // Pool was champ-1 (0.5), challenger-1 (0.9), challenger-2 (0.2).
    // New champions should be challenger-1 (0.9) and champ-1 (0.5).
    // challenger-2 (0.2) is dethroned back to pot.
    expect(result.champions.map((c) => c.id)).toEqual(['challenger-1', 'champ-1']);
    expect(result.dethroned.map((d) => d.id)).toEqual(['challenger-2']);

    // Next challengers picked from pot (batchSize 2): pot-1, pot-2
    expect(result.nextChallengers).toHaveLength(2);
    expect(result.nextChallengers.map((n) => n.id)).toEqual(['pot-1', 'pot-2']);
    expect(result.activeIdeaIds).toEqual(['pot-1', 'pot-2']);

    // Check room update was recorded
    expect(mockUpdates['rooms/room-1']).toBeDefined();
    expect(mockUpdates['rooms/room-1'].activeIdeaIds).toEqual(['pot-1', 'pot-2']);
    expect(typeof mockUpdates['rooms/room-1'].lastShuffledAt).toBe('number');

    // Check notifications
    expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledTimes(1);
    expect(result.notifications.successCount).toBe(2);
  });

  it('safely rotates when remaining pot has fewer than N ideas', async () => {
    const roomData: Room = {
      id: 'room-short',
      code: 'SHORT1',
      name: 'Small Room',
      hostUserId: 'user-1',
      leaderboardLimit: 3,
      activeIdeaIds: ['idea-1'],
      createdAt: Date.now(),
    };

    const ideasData: Idea[] = [
      { id: 'idea-1', code: 'I-1', title: '1', oneLiner: '1', category: 'C', status: 'active', likesCount: 1, passesCount: 0, score: 1 },
      { id: 'pot-only-1', code: 'I-2', title: '2', oneLiner: '2', category: 'C', status: 'pot', likesCount: 0, passesCount: 0, score: 0 },
    ];

    const mockUpdates: Record<string, any> = {};

    const mockDb = {
      collection: () => ({
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () => roomData,
          }),
          update: async (patch: any) => {
            mockUpdates['room'] = patch;
          },
          collection: () => ({
            get: async () => ({
              docs: ideasData.map((i) => ({ id: i.id, data: () => i })),
            }),
            doc: () => ({ update: async () => {} }),
          }),
        }),
        where: () => ({
          get: async () => ({ docs: [] }),
        }),
      }),
    };

    const result = await executeRoomShuffle('room-short', mockDb as any);
    expect(result.nextChallengers).toHaveLength(1);
    expect(result.nextChallengers[0].id).toBe('pot-only-1');
  });
});

describe('isRoomDueForShuffle', () => {
  it('returns true when schedule is enabled, matches day of week and hour', () => {
    const mockDate = new Date('2026-11-09T09:15:00Z'); // Monday (1), 09:15 UTC
    const schedule = {
      enabled: true,
      time: '09:00',
      timezone: 'UTC',
      daysOfWeek: [1, 2, 3, 4, 5],
    };

    expect(isRoomDueForShuffle(schedule, mockDate)).toBe(true);
  });

  it('returns false when schedule is disabled', () => {
    const mockDate = new Date('2026-11-09T09:15:00Z');
    const schedule = {
      enabled: false,
      time: '09:00',
      timezone: 'UTC',
      daysOfWeek: [1, 2, 3, 4, 5],
    };

    expect(isRoomDueForShuffle(schedule, mockDate)).toBe(false);
  });

  it('returns false when hour does not match', () => {
    const mockDate = new Date('2026-11-09T14:15:00Z');
    const schedule = {
      enabled: true,
      time: '09:00',
      timezone: 'UTC',
      daysOfWeek: [1, 2, 3, 4, 5],
    };

    expect(isRoomDueForShuffle(schedule, mockDate)).toBe(false);
  });

  it('returns false when day of week does not match', () => {
    const mockDate = new Date('2026-11-08T09:15:00Z'); // Sunday (0)
    const schedule = {
      enabled: true,
      time: '09:00',
      timezone: 'UTC',
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
    };

    expect(isRoomDueForShuffle(schedule, mockDate)).toBe(false);
  });
});

describe('Cloud Functions exports', () => {
  it('exports onScheduledShuffle, apiShuffleRoom, apiSyncDoc, executeRoomShuffle, and pickNextChallengers', async () => {
    const functionsModule = await import('../src/index');
    expect(typeof functionsModule.onScheduledShuffle).toBe('function');
    expect(typeof functionsModule.apiShuffleRoom).toBe('function');
    expect(typeof functionsModule.apiSyncDoc).toBe('function');
    expect(typeof functionsModule.executeRoomShuffle).toBe('function');
    expect(typeof functionsModule.pickNextChallengers).toBe('function');
  });

  it('apiShuffleRoom rejects missing roomId with 400', async () => {
    const { apiShuffleRoom } = await import('../src/index');

    let statusCode = 0;
    let jsonBody: any = null;

    const req = {
      query: {},
      body: {},
      headers: {},
      method: 'POST',
    } as any;

    const res = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
      on: vi.fn(),
      emit: vi.fn(),
      setHeader: vi.fn(),
      getHeader: vi.fn(),
    } as any;

    await (apiShuffleRoom as any)(req, res);

    expect(statusCode).toBe(400);
    expect(jsonBody?.error).toContain('roomId');
  });

  it('apiSyncDoc rejects missing roomId or docUrl with 400', async () => {
    const { apiSyncDoc } = await import('../src/index');

    let statusCode = 0;
    let jsonBody: any = null;

    const req = {
      query: {},
      body: {},
      headers: {},
      method: 'POST',
    } as any;

    const res = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
      on: vi.fn(),
      emit: vi.fn(),
      setHeader: vi.fn(),
      getHeader: vi.fn(),
    } as any;

    await (apiSyncDoc as any)(req, res);

    expect(statusCode).toBe(400);
    expect(jsonBody?.error).toContain('Missing required parameters');
  });
});

