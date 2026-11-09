# IdeaSwipe - System Design Specification

## Overview & Intent
**IdeaSwipe** is a mobile-first Progressive Web Application (PWA) designed to build group consensus on ideas among friend circles using dating-app swipe mechanics. Instead of drowning users in infinite unstructured lists, IdeaSwipe maintains a controlled active window of $N$ ideas (matching the leaderboard size, default 3) that participants swipe right (Like) or left (Pass) on. Ideas are managed in a central pot—either directly in the UI or synced from a Google Doc using a structured template. Daily automated shuffles cycle ideas into the active deck and alert raters via Web Push notifications.

---

## Goals & Anti-Goals

### Goals
- **Frictionless Auth & Access:** Fast sign-in via Google OAuth or Email verification code (OTP). Joining a room via direct link or 6-digit room code.
- **Controlled Active Deck:** At any given time, raters evaluate exactly $N$ ideas (where $N$ = leaderboard size, default 3).
- **Consensus Leaderboard:** Real-time scoreboard showing the top $N$ ideas ranked by positive rating percentage.
- **Flexible Idea Sourcing:** Add/edit/archive ideas directly in the UI or sync from a Google Doc using the standard `### ★ I-xxx` format. App provides a template doc link.
- **Daily Shuffle & Alerts:** Configurable schedule (e.g., daily 10:00 AM or workdays 3:00 PM) that rotates fresh ideas from the pot into the active batch and triggers Web Push notifications.
- **Design System:** Minimalist Abyssal Jade Holographic theme matching the Command Center (obsidian canvas `#030705`, jade `#10b981`, mint `#d1fae5`, tabular monospace digits, holographic glass cards).

### Non-Goals
- Native App Store / Play Store binary distribution (PWA installability via browser).
- Public global social network or algorithm-driven recommendation feeds (private friend groups only).

### Anti-Goals
- Endless-scroll card fatigue.
- Mandatory complex profile creation before rating.
- Cluttered, bright, generic consumer UI.

---

## Approaches Considered

1. **Firebase + React PWA (Selected)**
   - *Architecture:* Vite + React + PWA on Firebase Hosting; Cloud Firestore for real-time room and leaderboard state; Firebase Auth for Google OAuth + Email Link/OTP; Cloud Functions + Cloud Scheduler + Firebase Cloud Messaging (FCM) for cron shuffles and Web Push.
   - *Rationale:* Out-of-the-box support for required auth methods, instant real-time data sync, and turn-key push notifications with minimal custom plumbing.

2. **Cloudflare Stack (Workers + D1 + Pages)**
   - *Architecture:* React on Cloudflare Pages, Worker API with D1 SQLite, native VAPID Web Push, Cron Triggers.
   - *Trade-off:* Great edge performance, but requires building custom authentication flows for Google OAuth and email OTP.

3. **Supabase + Next.js PWA**
   - *Architecture:* Next.js on Vercel, Supabase Auth + Postgres Realtime, Edge Functions for cron.
   - *Trade-off:* Clean relational schema, but heavier dependency footprint and more complex PWA service worker integration.

---

## Architecture & Data Design

### Tech Stack
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS with Abyssal Jade design tokens, Lucide React icons.
- **Gestures/Animation:** Custom pointer/touch swipe engine or `framer-motion` spring animations for 60fps card swiping.
- **PWA:** `vite-plugin-pwa` with custom Service Worker registering Firebase Messaging for background push notifications.
- **Backend / Database:** Cloud Firestore, Firebase Authentication, Cloud Functions (Node.js 20).
- **Scheduling:** Google Cloud Scheduler invoking Cloud Function endpoint for room shuffles.

### Firestore Schema

#### `rooms/{roomId}`
```typescript
interface Room {
  id: string;
  code: string;                 // 6-character room code (e.g. "SWP402")
  name: string;                 // "Friday Night Ideas"
  hostUserId: string;
  leaderboardLimit: number;     // N (default 3)
  activeIdeaIds: string[];      // Current batch of N idea IDs
  schedule: {
    enabled: boolean;
    time: string;               // "10:00" (24h)
    timezone: string;           // "America/New_York"
    daysOfWeek: number[];       // [1,2,3,4,5] (1=Mon, 7=Sun)
  };
  googleDoc?: {
    docId: string;
    lastSyncedAt: number;
  };
  createdAt: number;
}
```

#### `rooms/{roomId}/ideas/{ideaId}`
```typescript
interface Idea {
  id: string;
  code: string;                 // e.g. "I-014"
  title: string;
  oneLiner: string;
  problemStatement?: string;
  targetAudience?: string;
  category: string;
  status: 'pot' | 'active' | 'archived';
  likesCount: number;
  passesCount: number;
  score: number;                // percentage: likes / (likes + passes)
  updatedAt: number;
}
```

#### `rooms/{roomId}/swipes/{swipeId}`
```typescript
interface Swipe {
  id: string;                   // `${userId}_${ideaId}`
  userId: string;
  ideaId: string;
  vote: 'like' | 'pass';
  timestamp: number;
}
```

#### `users/{userId}`
```typescript
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  fcmTokens: string[];          // Web Push endpoint tokens
  roomsJoined: string[];
}
```

---

## Core Flows & Behavior

### 1. Room Creation & Invites
- Host creates a room, sets name and leaderboard limit $N$ (default 3).
- System assigns a unique 6-character alphanumeric code and shareable URL (`https://app.domain/join/SWP402`).
- Invitee opens URL or enters code on the app home screen.
- If unauthenticated, user is prompted to sign in with Google or enter an email for instant verification code.

### 2. Idea Ingestion & Google Doc Sync
- Host can add cards directly in the app.
- Host can click "Import / Sync Google Doc" on demand:
  - App displays "Copy Template" button pointing to a formatted doc template.
  - Template structure:
    ```markdown
    ### ★ I-001 Title
    - Status: active
    - Idea: One-sentence summary
    - Why it matters: Problem statement
    - Smallest next step: Target audience or immediate action
    ```
  - Fetch mechanism: Uses Google Docs public view/export endpoint (`https://docs.google.com/document/d/{docId}/export?format=txt`) with zero OAuth friction.
  - Sync cadence: Explicit on-demand sync button in the Host dashboard (prevents automated background overwrite conflicts with in-app card edits).

### 3. Email Authentication with Code (OTP)
- Supports Google One-Tap / OAuth directly via Firebase Auth SDK.
- For email login: User enters email; a lightweight Cloud Function generates a secure 6-digit numeric OTP with 10-minute expiration, delivers it via email service, and upon verification mints a Firebase Auth custom token.

### 3. Active Batch Swiping
- Each rater in the room receives a card deck containing the currently active $N$ ideas.
- Swiping right records a `like`; swiping left records a `pass`.
- Swipes write idempotently to `rooms/{roomId}/swipes/${userId}_${ideaId}` and increment the idea's counters atomically via Firestore transaction.
- When all $N$ cards are swiped, rater is shown the Leaderboard View with real-time room progress.

### 4. Leaderboard & Pot Lifecycle (King of the Hill)
- **Host Pot Curation:**
  - Host controls which ideas enter, stay, or leave the pot at all times.
  - In UI: Host can toggle ideas as `in_pot`, `archived`, or deleted.
  - In Google Doc: Setting `- Status: dropped` archives an idea; `- Status: active` keeps it in the active pot.
- **King of the Hill Mechanics:**
  - Leaderboard holds the all-time Top $N$ champion ideas (highest group approval percentage).
  - Each daily shuffle selects $N$ unvoted or active challenger ideas from the pot.
  - When raters complete their daily swipe deck, challenger scores are evaluated.
  - If a challenger achieves a higher consensus percentage than a current leaderboard champion, it takes its spot on the leaderboard.
  - The dethroned idea moves back to the pot, remaining available for future rounds unless the host archives it.

### 5. Daily Shuffle & Notifications
- Cloud Scheduler triggers an execution worker based on the room's schedule (`schedule.time`, `schedule.daysOfWeek`).
- **Shuffle algorithm:**
  - Evaluates current active challenger ideas against the Leaderboard.
  - Retains the Top $N$ champions on the Leaderboard.
  - Draws the next $N$ active challenger ideas from the host-curated pot.
  - Resets member swipe status for the new round.
  - Sends an FCM multicast push notification to all room members:
    - Title: `IdeaSwipe: New batch in ${room.name}`
    - Body: `Your ${N} new ideas are ready to swipe today.`
    - Direct deep-link URL into the room's swipe stack.

---

## Design System & Theme Tokens

- **Palette:**
  - Canvas: Obsidian `#030705`
  - Surfaces / Modals: Dark Jade `#06120d`, `#0c2018`, elevated well `#122c22`
  - Primary Accent: Jade `#10b981`, Focus Jade `#34d399`
  - Text & Accents: Mint `#d1fae5`, Ivory `#f0fdf4`, Muted Jade `#6ee7b7`
  - Accents: Cyan `#06b6d4`, Rose (Pass) `#f43f5e`, Jade (Like) `#10b981`
- **Typography:** Sans-serif UI (Inter / system) paired with Tabular Monospace (JetBrains Mono / SF Mono) for codes (`I-014`) and stats (`100% (4/4)`).
- **Haptic & Feedback:** Spring physics for swipe release, subtle glow on like/pass thresholds.

---

## Responsibilities Left to Builder
- Specific swipe acceleration and rotation curves (touch/mouse drag).
- Fallback in-app polling banner if browser permissions deny Web Push notifications.
- Local storage offline caching of current active deck.
