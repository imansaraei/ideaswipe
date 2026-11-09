# IdeaSwipe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy IdeaSwipe, a mobile-first Progressive Web App (PWA) that allows friend groups to swipe on batches of $N$ ideas, maintain a real-time King of the Hill leaderboard, sync cards from a Google Doc template, and receive daily shuffle notifications.

**Architecture:** Client-side Vite + React + TypeScript PWA styled with Tailwind CSS and Abyssal Jade holographic design tokens. Firebase Auth handles Google OAuth and Email OTP; Cloud Firestore manages real-time rooms, active decks, and swipe tallies; Cloud Functions execute Google Doc ingestion, OTP code generation, and Cloud Scheduler daily shuffles with FCM Web Push alerts.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Firebase (Auth, Firestore, Cloud Functions, Messaging), `vite-plugin-pwa`, Vitest, Testing Library.

**Spec:** [docs/superpowers/specs/2026-11-09-ideaswipe-design.md](file:///Users/imansaraei/Documents/Antigravity/Match/docs/superpowers/specs/2026-11-09-ideaswipe-design.md)

## Global Constraints

- **Theme & Colors:** Abyssal Jade theme strictly enforced. Obsidian canvas `#030705`, dark jade surfaces `#06120d`, `#0c2018`, elevated well `#122c22`, jade accents `#10b981`, `#34d399`, mint text `#d1fae5`, `#f0fdf4`, cyan `#06b6d4`, rose pass `#f43f5e`.
- **Tabular Monospace:** Tabular monospace digits for idea codes (`I-014`), percentages, and room codes (`SWP402`).
- **Batch Window:** Active deck size equals leaderboard capacity $N$ (default 3).
- **Google Doc Template:** Parse markdown-formatted docs adhering to `### ★ I-xxx` schema.
- **King of the Hill:** Top $N$ ideas remain on the leaderboard; challengers replace lower-scoring champions; dethroned champions return to the pot unless archived.

## Review Focus

1. **Unauthenticated direct link access (`/join/:code`):** User without session must preserve join intent and redirect back to the room upon completing Google or OTP login.
2. **Google Doc malformed syntax:** If imported document has missing fields or unexpected formatting, parser must safely extract valid lines and fall back to sensible defaults without corrupting existing pot.
3. **Concurrent last-card swipes:** Multiple users submitting the final card simultaneously must not corrupt vote counters or drop votes (uses atomic Firestore increments).
4. **Web Push permission denied:** If a user denies notification permissions, app must gracefully degrade without error toasts and show an in-app indicator instead.
5. **Pot exhaustion on shuffle:** When fewer than $N$ ideas remain in the pot, shuffle must serve available ideas without crashing or getting stuck.

---

### Task 1: Project Scaffolding & Abyssal Jade Theme Setup

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.js`
- Create: `src/index.css`
- Create: `src/App.tsx`
- Create: `src/main.tsx`
- Test: `tests/theme.test.ts`

**Interfaces:**
- Produces: CSS design token classes (`bg-obsidian`, `text-mint`, `border-jade-glow`, `font-mono-tabular`) and baseline React application shell.

- [ ] **Step 1: Write the failing theme and styling test**

```typescript
// tests/theme.test.ts
import { describe, it, expect } from 'vitest';
import { themeColors } from '../src/styles/tokens';

describe('Abyssal Jade Theme Tokens', () => {
  it('defines correct obsidian canvas and jade/mint brand colors', () => {
    expect(themeColors.canvas).toBe('#030705');
    expect(themeColors.jadeAccent).toBe('#10b981');
    expect(themeColors.mintText).toBe('#d1fae5');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/theme.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Initialize Vite + React + Tailwind and implement tokens**

Create `package.json`, configure Tailwind with Abyssal Jade palette (`obsidian: #030705`, `surface: #06120d`, `card: #0c2018`, `jade: #10b981`, `mint: #d1fae5`, `rose: #f43f5e`), export `src/styles/tokens.ts`, and set up baseline layout in `src/App.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/theme.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json vite.config.ts tsconfig.json tailwind.config.js src/ tests/
git commit -m "feat: scaffold Vite React PWA with Abyssal Jade theme tokens"
```

---

### Task 2: Core Domain Logic & Google Doc Parser (TDD)

**Files:**
- Create: `src/types/index.ts`
- Create: `src/lib/parser.ts`
- Create: `src/lib/leaderboard.ts`
- Test: `tests/parser.test.ts`
- Test: `tests/leaderboard.test.ts`

**Interfaces:**
- Produces:
  - `parseIdeasFromDoc(content: string): Idea[]`
  - `evaluateKingOfTheHill(currentChampions: Idea[], challengers: Idea[], limit: number): { champions: Idea[], backToPot: Idea[] }`
  - Types: `Room`, `Idea`, `Swipe`, `UserProfile`

- [ ] **Step 1: Write failing tests for Google Doc parser and King of the Hill logic**

```typescript
// tests/parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseIdeasFromDoc } from '../src/lib/parser';

describe('parseIdeasFromDoc', () => {
  it('parses valid markdown format into structured ideas', () => {
    const markdown = `
### ★ I-014 Interactive Webinar Companion
- Status: active
- Idea: A companion app for workshops replacing passive chat.
- Why it matters: Keeps participants engaged.
- Smallest next step: Build single-screen MVP.
    `;
    const ideas = parseIdeasFromDoc(markdown);
    expect(ideas).toHaveLength(1);
    expect(ideas[0].code).toBe('I-014');
    expect(ideas[0].title).toBe('I-014: Interactive Webinar Companion');
    expect(ideas[0].oneLiner).toContain('companion app for workshops');
    expect(ideas[0].status).toBe('pot');
  });

  it('marks dropped ideas as archived', () => {
    const markdown = `
### ★ I-005 Dropped Concept
- Status: dropped
- Idea: Old concept.
    `;
    const ideas = parseIdeasFromDoc(markdown);
    expect(ideas[0].status).toBe('archived');
  });
});

// tests/leaderboard.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateKingOfTheHill } from '../src/lib/leaderboard';

describe('evaluateKingOfTheHill', () => {
  it('dethrones a lower scoring champion when challenger has higher consensus', () => {
    const champions = [
      { id: '1', score: 0.8, likesCount: 4, passesCount: 1 } as any,
      { id: '2', score: 0.5, likesCount: 2, passesCount: 2 } as any,
    ];
    const challengers = [
      { id: '3', score: 0.9, likesCount: 9, passesCount: 1 } as any,
    ];

    const result = evaluateKingOfTheHill(champions, challengers, 2);
    expect(result.champions.map(c => c.id)).toEqual(['3', '1']);
    expect(result.backToPot.map(b => b.id)).toEqual(['2']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/parser.test.ts tests/leaderboard.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement parser and leaderboard evaluation**

Implement `src/types/index.ts`, `src/lib/parser.ts` (with regex splitting on `### ★ ` and bullet-point extraction), and `src/lib/leaderboard.ts` (sorting by score percentage descending and trimming to capacity $N$).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/parser.test.ts tests/leaderboard.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/ src/lib/ tests/
git commit -m "feat: add Google Doc parser and King of the Hill evaluation engine"
```

---

### Task 3: Firebase Auth & Room Code Services

**Files:**
- Create: `src/services/firebase.ts`
- Create: `src/services/auth.ts`
- Create: `src/components/AuthModal.tsx`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: Firebase configuration env variables.
- Produces:
  - `signInWithGoogle(): Promise<User>`
  - `requestEmailOtp(email: string): Promise<void>`
  - `verifyEmailOtp(email: string, code: string): Promise<User>`
  - `generateRoomCode(): string`

- [ ] **Step 1: Write failing test for room code generation and auth state service**

```typescript
// tests/auth.test.ts
import { describe, it, expect } from 'vitest';
import { generateRoomCode } from '../src/services/auth';

describe('generateRoomCode', () => {
  it('produces a 6-character uppercase alphanumeric code', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Firebase Auth client and AuthModal component**

Implement `src/services/firebase.ts` with graceful mock/offline fallback, `src/services/auth.ts`, and `src/components/AuthModal.tsx` styled with holographic HUD borders, Google sign-in button, and 6-digit verification code input.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/auth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/ src/components/AuthModal.tsx tests/auth.test.ts
git commit -m "feat: implement Firebase Auth service and Abyssal Jade AuthModal"
```

---

### Task 4: Room Creation, Pot Management & Google Doc Import UI

**Files:**
- Create: `src/services/roomService.ts`
- Create: `src/components/CreateRoomModal.tsx`
- Create: `src/components/HostDashboard.tsx`
- Create: `src/components/GoogleDocImportModal.tsx`
- Test: `tests/roomService.test.ts`

**Interfaces:**
- Consumes: `Room`, `Idea`, `parseIdeasFromDoc`
- Produces:
  - `createRoom(hostUserId: string, name: string, limit: number, schedule?: any): Promise<Room>`
  - `syncGoogleDoc(roomId: string, docUrlOrId: string): Promise<number>`
  - `toggleIdeaStatus(roomId: string, ideaId: string, status: 'pot' | 'archived'): Promise<void>`

- [ ] **Step 1: Write failing test for room creation and doc sync service**

```typescript
// tests/roomService.test.ts
import { describe, it, expect, vi } from 'vitest';
import { extractDocIdFromUrl } from '../src/services/roomService';

describe('extractDocIdFromUrl', () => {
  it('extracts ID from standard Google Doc URLs', () => {
    const url = 'https://docs.google.com/document/d/1-HzWk1wHnjp_3RETtdaNX7MoXuGv5XEzp223WfvIlFE/edit';
    expect(extractDocIdFromUrl(url)).toBe('1-HzWk1wHnjp_3RETtdaNX7MoXuGv5XEzp223WfvIlFE');
  });

  it('accepts raw Doc ID directly', () => {
    const id = '1-HzWk1wHnjp_3RETtdaNX7MoXuGv5XEzp223WfvIlFE';
    expect(extractDocIdFromUrl(id)).toBe(id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/roomService.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement room creation and host curation UI**

Build `src/services/roomService.ts`, `src/components/CreateRoomModal.tsx`, `src/components/GoogleDocImportModal.tsx` (with "Copy Template" button that copies markdown schema to clipboard), and `src/components/HostDashboard.tsx` (viewing pot ideas, toggling status, triggering on-demand sync).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/roomService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/roomService.ts src/components/ tests/roomService.test.ts
git commit -m "feat: add room creation, Google Doc import modal, and pot curation dashboard"
```

---

### Task 5: 60fps Swipe Deck & Gesture Interaction

**Files:**
- Create: `src/components/SwipeCard.tsx`
- Create: `src/components/SwipeDeck.tsx`
- Create: `src/hooks/useSwipeGesture.ts`
- Test: `tests/useSwipeGesture.test.ts`

**Interfaces:**
- Consumes: Active $N$ ideas from `Room.activeIdeaIds`
- Produces:
  - `<SwipeDeck ideas={ideas} onSwipe={(ideaId, direction) => void} onFinish={() => void} />`
  - Atomic vote write helper `recordSwipe(roomId, userId, ideaId, direction)`

- [ ] **Step 1: Write failing test for swipe direction calculation**

```typescript
// tests/useSwipeGesture.test.ts
import { describe, it, expect } from 'vitest';
import { calculateSwipeDecision } from '../src/hooks/useSwipeGesture';

describe('calculateSwipeDecision', () => {
  it('returns like when dragged past right threshold', () => {
    expect(calculateSwipeDecision(150, 0, 100)).toBe('like');
  });

  it('returns pass when dragged past left threshold', () => {
    expect(calculateSwipeDecision(-150, 0, 100)).toBe('pass');
  });

  it('returns null when within threshold', () => {
    expect(calculateSwipeDecision(40, 0, 100)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/useSwipeGesture.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement touch/mouse gesture hook and card stack components**

Create `src/hooks/useSwipeGesture.ts` supporting pointer drag, threshold detection, and spring release. Create `src/components/SwipeCard.tsx` with dynamic rotation, jade glow (like), and rose glow (pass). Create `src/components/SwipeDeck.tsx` rendering the active $N$ cards with counter ("1 of 3") and finish screen.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/useSwipeGesture.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SwipeCard.tsx src/components/SwipeDeck.tsx src/hooks/ tests/useSwipeGesture.test.ts
git commit -m "feat: implement 60fps holographic swipe deck with pointer gestures"
```

---

### Task 6: King of the Hill Real-Time Leaderboard & Join Screen

**Files:**
- Create: `src/components/LeaderboardView.tsx`
- Create: `src/components/JoinRoomScreen.tsx`
- Create: `src/hooks/useRoomData.ts`
- Test: `tests/leaderboardView.test.tsx`

**Interfaces:**
- Consumes: Room snapshot, Idea list, Swipe stats
- Produces:
  - `<LeaderboardView roomId={roomId} limit={N} />`
  - `<JoinRoomScreen onJoinSuccess={(room) => void} />`

- [ ] **Step 1: Write failing test for leaderboard ranking calculation**

```typescript
// tests/leaderboardView.test.tsx
import { describe, it, expect } from 'vitest';
import { rankLeaderboardIdeas } from '../src/lib/leaderboard';

describe('rankLeaderboardIdeas', () => {
  it('ranks ideas by like percentage and displays vote metrics', () => {
    const ideas = [
      { id: '1', title: 'Idea 1', likesCount: 3, passesCount: 1 }, // 75%
      { id: '2', title: 'Idea 2', likesCount: 4, passesCount: 0 }, // 100%
      { id: '3', title: 'Idea 3', likesCount: 1, passesCount: 3 }, // 25%
    ] as any;

    const ranked = rankLeaderboardIdeas(ideas, 2);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].id).toBe('2');
    expect(ranked[1].id).toBe('1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/leaderboardView.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement LeaderboardView and JoinRoomScreen**

Implement `src/components/LeaderboardView.tsx` with live progress bars, consensus percentage in tabular monospace font, and member completion counts. Implement `src/components/JoinRoomScreen.tsx` for entering 6-character room codes or parsing query parameters.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/leaderboardView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/LeaderboardView.tsx src/components/JoinRoomScreen.tsx src/hooks/useRoomData.ts tests/leaderboardView.test.tsx
git commit -m "feat: add real-time King of the Hill leaderboard and room join screen"
```

---

### Task 7: Scheduled Daily Shuffle & Cloud Functions Backend

**Files:**
- Create: `functions/package.json`
- Create: `functions/src/index.ts`
- Create: `functions/src/shuffle.ts`
- Create: `functions/src/notifications.ts`
- Test: `functions/tests/shuffle.test.ts`

**Interfaces:**
- Produces:
  - `executeRoomShuffle(roomId: string): Promise<ShuffleResult>`
  - `sendBatchNotification(tokens: string[], roomName: string, batchSize: number): Promise<void>`
  - Cloud Functions: `onScheduledShuffle` (hourly trigger) and `apiSyncDoc`

- [ ] **Step 1: Write failing test for shuffle rotation algorithm**

```typescript
// functions/tests/shuffle.test.ts
import { describe, it, expect } from 'vitest';
import { pickNextChallengers } from '../src/shuffle';

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
    expect(selected.every(s => s.status === 'pot')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run functions/tests/shuffle.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Cloud Functions for daily shuffle and FCM push**

Implement `functions/src/shuffle.ts` (executes King of the Hill promotion, rotates $N$ new ideas from pot to `activeIdeaIds`, resets round), `functions/src/notifications.ts` (sends FCM multicast notification), and `functions/src/index.ts` (exporting Cloud Scheduler handler).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run functions/tests/shuffle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/
git commit -m "feat: implement Cloud Functions for daily idea shuffle and FCM notifications"
```

---

### Task 8: PWA Configuration, Service Worker & Web Push Registration

**Files:**
- Create: `public/manifest.json`
- Create: `public/firebase-messaging-sw.js`
- Create: `src/services/notifications.ts`
- Modify: `vite.config.ts`
- Modify: `src/App.tsx`
- Test: `tests/pwa.test.ts`

**Interfaces:**
- Consumes: FCM Web VAPID key
- Produces:
  - `requestNotificationPermission(): Promise<string | null>`
  - Registered Service Worker with background push alert handling
  - Installable PWA manifest

- [ ] **Step 1: Write failing test for Web App Manifest configuration**

```typescript
// tests/pwa.test.ts
import { describe, it, expect } from 'vitest';
import manifest from '../public/manifest.json';

describe('PWA Manifest', () => {
  it('defines standalone display and theme color #030705', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#030705');
    expect(manifest.background_color).toBe('#030705');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pwa.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement PWA manifest, service worker, and notification hook**

Create `public/manifest.json`, `public/firebase-messaging-sw.js` (listening to `push` and `notificationclick` events), `src/services/notifications.ts` (registering token to user profile in Firestore), and wire up install prompt & push permission toggle in `src/App.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pwa.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite & production build check**

Run: `npm test && npm run build`
Expected: All tests pass, production bundle generated with zero errors.

- [ ] **Step 6: Commit**

```bash
git add public/ src/services/notifications.ts vite.config.ts src/App.tsx tests/pwa.test.ts
git commit -m "feat: configure PWA manifest, FCM service worker, and web push toggle"
```
