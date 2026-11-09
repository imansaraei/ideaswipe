import React, { useState, useEffect } from 'react';
import { Sparkles, Layers, Trophy, Bell, BellOff, Download, X } from 'lucide-react';
import {
  requestNotificationPermission,
  getNotificationPermission,
  registerServiceWorker,
} from './services/notifications';
import { getCurrentUser } from './services/auth';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const App: React.FC = () => {
  const [isSubscribed, setIsSubscribed] = useState<boolean>(() => {
    return getNotificationPermission() === 'granted';
  });
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);

  useEffect(() => {
    // Register background FCM Service Worker
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

  const handleToggleNotifications = async () => {
    const user = getCurrentUser();
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

  return (
    <div className="min-h-screen bg-obsidian text-mint flex flex-col items-center justify-between p-4 selection:bg-jade/30">
      {/* Header */}
      <header className="w-full max-w-md flex items-center justify-between py-4 border-b border-jade/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-surface border border-jade/40 flex items-center justify-center border-jade-glow">
            <Sparkles className="w-4 h-4 text-jade" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-mint">
            Idea<span className="text-jade">Swipe</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
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

          <div className="px-3 py-1 rounded-full bg-surface border border-jade/30 text-xs font-mono-tabular text-jade">
            ROOM: SWP001
          </div>
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
              <p className="font-semibold text-ivory">Install IdeaSwipe</p>
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

      {/* Main Content Area / Deck Shell */}
      <main className="w-full max-w-md my-auto flex flex-col items-center justify-center py-6">
        <div className="w-full bg-card rounded-2xl border border-jade/30 p-6 border-jade-glow flex flex-col gap-4">
          <div className="flex items-center justify-between text-xs text-mint/60">
            <span className="font-mono-tabular">CARD 01 / 03</span>
            <span className="px-2 py-0.5 rounded bg-surface border border-jade/20 text-jade font-mono-tabular">
              ★ I-001
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-ivory">
              Welcome to IdeaSwipe
            </h2>
            <p className="text-sm text-mint/80 leading-relaxed">
              Consensus-driven idea curation for friend groups. Swipe right to like, left to pass.
            </p>
          </div>

          <div className="pt-4 border-t border-jade/10 flex items-center justify-between text-xs">
            <span className="text-mint/60 font-mono-tabular">Score: 100%</span>
            <span className="text-jade">Abyssal Jade Theme</span>
          </div>
        </div>
      </main>

      {/* Navigation / Bottom Bar */}
      <footer className="w-full max-w-md flex items-center justify-around py-3 px-6 rounded-2xl bg-surface/80 backdrop-blur border border-jade/20">
        <button
          type="button"
          className="flex flex-col items-center gap-1 text-jade hover:text-jade-focus transition-colors"
          aria-label="Swipe Deck"
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px] uppercase font-medium">Deck</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1 text-mint/60 hover:text-mint transition-colors"
          aria-label="Leaderboard"
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px] uppercase font-medium">Rankings</span>
        </button>
      </footer>
    </div>
  );
};

export default App;
