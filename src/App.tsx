import React from 'react';
import { Sparkles, Layers, Trophy } from 'lucide-react';

export const App: React.FC = () => {
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
        <div className="px-3 py-1 rounded-full bg-surface border border-jade/30 text-xs font-mono-tabular text-jade">
          ROOM: SWP001
        </div>
      </header>

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
