export type IdeaStatus = 'pot' | 'active' | 'archived';

export interface Idea {
  id: string;
  code: string;
  title: string;
  oneLiner: string;
  problemStatement?: string;
  targetAudience?: string;
  category: string;
  status: IdeaStatus;
  likesCount: number;
  passesCount: number;
  score: number;
  updatedAt?: number;
  createdAt?: number;
}

export interface RoomSchedule {
  enabled: boolean;
  time: string;
  timezone: string;
  daysOfWeek: number[];
}

export interface GoogleDocConfig {
  docId: string;
  lastSyncedAt: number;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  hostUserId: string;
  leaderboardLimit: number;
  activeIdeaIds: string[];
  schedule?: RoomSchedule;
  googleDoc?: GoogleDocConfig;
  createdAt: number;
}

export type SwipeVote = 'like' | 'pass';

export interface Swipe {
  id: string;
  userId: string;
  ideaId: string;
  vote: SwipeVote;
  timestamp: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  fcmTokens?: string[];
  roomsJoined?: string[];
}

export interface KingOfTheHillResult {
  champions: Idea[];
  backToPot: Idea[];
}
