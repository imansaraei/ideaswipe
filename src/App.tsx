import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Layers,
  Trophy,
  Bell,
  BellOff,
  Download,
  X,
  Copy,
  Check,
  Shield,
  User as UserIcon,
  LogIn,
  LogOut,
} from 'lucide-react';
import { type User } from 'firebase/auth';
import { Room } from './types';
import { getRoom } from './services/roomService';
import { getCurrentUser, onAuthStateChange, signOutUser } from './services/auth';
import {
  requestNotificationPermission,
  getNotificationPermission,
  registerServiceWorker,
} from './services/notifications';
import { useRoomData } from './hooks/useRoomData';
import { JoinRoomScreen, parseRoomCodeFromUrl } from './components/JoinRoomScreen';
import { SwipeDeck } from './components/SwipeDeck';
import { LeaderboardView } from './components/LeaderboardView';
import { HostDashboard } from './components/HostDashboard';
import { AuthModal } from './components/AuthModal';
import { CreateRoomModal } from './components/CreateRoomModal';
import { GoogleDocImportModal } from './components/GoogleDocImportModal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [room, setRoom] = useState<Room | null>(null);
  const [activeTab, setActiveTab] = useState<'deck' | 'rankings' | 'host'>('deck');
  const [copiedCode, setCopiedCode] = useState(false);

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  // Notifications & PWA
  const [isSubscribed, setIsSubscribed] = useState<boolean>(() => {
    return getNotificationPermission() === 'granted';
  });
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);

  // Listen to Auth State
  useEffect(() => {
    const unsub = onAuthStateChange((currentUser) => {
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  // Listen to PWA install and register service worker
  useEffect(() => {
    registerServiceWorker();

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    const handleAppInstalled = () => {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Parse URL for /join/:code or ?code=... or ?room=... on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location) {
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      const detectedCode = parseRoomCodeFromUrl(currentUrl);
      if (detectedCode) {
        getRoom(detectedCode).then((foundRoom) => {
          if (foundRoom) {
            setRoom(foundRoom);
          }
        });
      }
    }
  }, []);

  // Room data hook
  const {
    room: liveRoom,
    ideas,
    activeBatch,
    swipedIdeaIds,
    participantCount,
    totalVotes,
    refresh,
  } = useRoomData(room?.id, room?.leaderboardLimit, user?.uid);

  const currentRoom = liveRoom || room;

  const handleToggleNotifications = async () => {
    const token = await requestNotificationPermission(user?.uid);
    if (token) {
      setIsSubscribed(true);
    }
  };

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShowInstallBanner(false);
        setInstallPrompt(null);
      }
    } catch (err) {
      console.warn('[PWA] Install prompt failed:', err);
    }
  };

  const handleCopyRoomCode = useCallback(async () => {
    if (!currentRoom) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentRoom.code);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }, [currentRoom]);

  const isHost = Boolean(
    user &&
      currentRoom &&
      currentRoom.hostUserId &&
      (user.uid === currentRoom.hostUserId ||
        currentRoom.hostUserId === 'anonymous_host' ||
        currentRoom.hostUserId === 'host_user')
  );

  return (
    <div className="min-h-screen bg-obsidian text-mint flex flex-col items-center justify-between p-4 selection:bg-jade/30">
      {/* Top Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-4 border-b border-jade/20 gap-3">
        {/* App Logo */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (currentRoom) setActiveTab('deck');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && currentRoom) setActiveTab('deck');
          }}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <div className="w-8 h-8 rounded-lg bg-surface border border-jade/40 flex items-center justify-center border-jade-glow shadow-sm">
            <Sparkles className="w-4 h-4 text-jade" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-mint-ivory">
            Idea<span className="text-jade">Swipe</span>
          </h1>
        </div>

        {/* Right header actions */}
        <div className="flex items-center gap-2">
          {/* Room Code Badge with Click-to-Copy */}
          {currentRoom && (
            <button
              type="button"
              onClick={handleCopyRoomCode}
              aria-label={`Copy room code ${currentRoom.code}`}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-jade/30 text-xs font-mono-tabular text-jade hover:border-jade/60 transition-colors cursor-pointer"
              title="Click to copy room code"
            >
              <span>ROOM: {currentRoom.code}</span>
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-jade" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-jade/70" />
              )}
            </button>
          )}

          {/* Notification Permission Toggle */}
          <button
            type="button"
            onClick={handleToggleNotifications}
            aria-label="Toggle notifications"
            className={`p-2 rounded-lg border transition-colors ${
              isSubscribed
                ? 'bg-jade/10 border-jade/50 text-jade shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'bg-surface border-jade/20 text-mint/60 hover:text-mint hover:border-jade/40'
            }`}
            title={isSubscribed ? 'Notifications enabled' : 'Enable daily shuffle notifications'}
          >
            {isSubscribed ? <Bell className="w-4 h-4 text-jade" /> : <BellOff className="w-4 h-4" />}
          </button>

          {/* User Auth / Profile Button */}
          {user ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                aria-label="User Profile"
                className="p-2 rounded-lg bg-surface border border-jade/20 text-mint/80 hover:text-jade hover:border-jade/40 flex items-center gap-1.5 text-xs font-medium"
                title={user.email || 'Signed in'}
              >
                <UserIcon className="w-4 h-4 text-jade" />
                <span className="hidden sm:inline max-w-[100px] truncate">
                  {user.displayName || user.email?.split('@')[0] || 'User'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => signOutUser()}
                aria-label="Sign out"
                className="p-2 rounded-lg bg-surface border border-jade/20 text-mint/50 hover:text-rose hover:border-rose/30 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              aria-label="Sign In"
              className="px-3 py-1.5 rounded-lg bg-well hover:bg-well/80 border border-jade/30 text-xs font-semibold text-jade flex items-center gap-1.5 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

          {/* Host Toggle (Visible when room loaded and user is host) */}
          {currentRoom && isHost && (
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'host' ? 'deck' : 'host')}
              aria-label={activeTab === 'host' ? 'Exit Host Dashboard' : 'Host Dashboard'}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'host'
                  ? 'bg-jade text-obsidian border-jade shadow-jade-glow'
                  : 'bg-surface border-jade/30 text-jade hover:border-jade/60'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{activeTab === 'host' ? 'Deck' : 'Host'}</span>
            </button>
          )}

          {/* Leave Room Button */}
          {currentRoom && (
            <button
              type="button"
              onClick={() => {
                setRoom(null);
                setActiveTab('deck');
              }}
              aria-label="Leave Room"
              className="p-2 rounded-lg bg-surface border border-jade/20 text-mint/50 hover:text-rose hover:border-rose/30 transition-colors"
              title="Leave room / Enter another room code"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Optional Install Banner */}
      {showInstallBanner && installPrompt && (
        <aside
          role="region"
          aria-label="Install App Banner"
          className="w-full max-w-md mt-3 px-4 py-3 rounded-xl bg-surface/95 border border-jade/40 border-jade-glow flex items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-jade/10 border border-jade/30 text-jade">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-mint-ivory">Install IdeaSwipe</p>
              <p className="text-mint/70 text-[11px]">Add to home screen for daily idea swiping</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-3 py-1.5 rounded-lg bg-jade hover:bg-jade-focus text-obsidian font-semibold transition-colors text-xs flex items-center gap-1"
              aria-label="Install App"
            >
              Install
            </button>
            <button
              type="button"
              onClick={() => setShowInstallBanner(false)}
              className="p-1 rounded-md text-mint/50 hover:text-mint hover:bg-surface-elevated transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="w-full max-w-4xl flex-1 flex flex-col items-center justify-center py-6">
        {!currentRoom ? (
          <JoinRoomScreen
            onJoinSuccess={(joined) => {
              setRoom(joined);
              setActiveTab('deck');
            }}
            onCreateRoom={() => setIsCreateModalOpen(true)}
          />
        ) : activeTab === 'host' ? (
          <HostDashboard
            room={currentRoom}
            initialIdeas={ideas}
            onOpenDocSync={() => setIsDocModalOpen(true)}
            onRoomUpdated={(updated) => {
              setRoom(updated);
              refresh();
            }}
          />
        ) : activeTab === 'rankings' ? (
          <LeaderboardView
            roomId={currentRoom.id}
            limit={currentRoom.leaderboardLimit}
            initialRoom={currentRoom}
            initialIdeas={ideas}
            participantCount={participantCount}
            totalVotes={totalVotes}
            onBack={() => setActiveTab('deck')}
          />
        ) : (
          <SwipeDeck
            ideas={activeBatch}
            swipedIdeaIds={swipedIdeaIds}
            roomId={currentRoom.id}
            userId={user?.uid || 'guest'}
            onFinish={() => setActiveTab('rankings')}
          />
        )}
      </main>

      {/* Navigation / Bottom Bar (Visible when in room and not in host dashboard, or as primary navigation) */}
      {currentRoom && (
        <footer className="w-full max-w-md flex items-center justify-around py-3 px-6 rounded-2xl bg-surface/90 backdrop-blur border border-jade/20 shadow-lg">
          <button
            type="button"
            onClick={() => setActiveTab('deck')}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'deck' ? 'text-jade font-semibold' : 'text-mint/60 hover:text-mint'
            }`}
            aria-label="Swipe Deck"
          >
            <Layers className="w-5 h-5" />
            <span className="text-[10px] uppercase font-medium">Deck</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rankings')}
            className={`flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'rankings' ? 'text-jade font-semibold' : 'text-mint/60 hover:text-mint'
            }`}
            aria-label="Leaderboard"
          >
            <Trophy className="w-5 h-5" />
            <span className="text-[10px] uppercase font-medium">Rankings</span>
          </button>
          {isHost && (
            <button
              type="button"
              onClick={() => setActiveTab('host')}
              className={`flex flex-col items-center gap-1 transition-colors ${
                activeTab === 'host' ? 'text-jade font-semibold' : 'text-mint/60 hover:text-mint'
              }`}
              aria-label="Host Dashboard"
            >
              <Shield className="w-5 h-5" />
              <span className="text-[10px] uppercase font-medium">Host</span>
            </button>
          )}
        </footer>
      )}

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(u) => setUser(u)}
      />

      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        hostUserId={user?.uid || 'anonymous_host'}
        onRoomCreated={(newRoom) => {
          setRoom(newRoom);
          setActiveTab('deck');
        }}
      />

      {currentRoom && (
        <GoogleDocImportModal
          isOpen={isDocModalOpen}
          onClose={() => setIsDocModalOpen(false)}
          roomId={currentRoom.id}
          currentDocId={currentRoom.googleDoc?.docId}
          onSynced={() => refresh()}
        />
      )}
    </div>
  );
};

export default App;
