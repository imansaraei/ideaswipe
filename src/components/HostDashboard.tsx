import React, { useState, useEffect } from 'react';
import {
  Layers,
  Archive,
  Flame,
  Copy,
  Check,
  RefreshCw,
  Shield,
  FileText,
  Sparkles,
} from 'lucide-react';
import { Room, Idea } from '../types';
import { getRoomIdeas, toggleIdeaStatus } from '../services/roomService';
import { GoogleDocImportModal } from './GoogleDocImportModal';

export interface HostDashboardProps {
  room: Room;
  initialIdeas?: Idea[];
  onToggleStatus?: (ideaId: string, newStatus: 'pot' | 'archived') => void;
  onOpenDocSync?: () => void;
  onRoomUpdated?: (room: Room) => void;
}

export const HostDashboard: React.FC<HostDashboardProps> = ({
  room,
  initialIdeas,
  onToggleStatus,
  onOpenDocSync,
}) => {
  const [ideas, setIdeas] = useState<Idea[]>(initialIdeas || []);
  const [activeTab, setActiveTab] = useState<'pot' | 'active' | 'archived'>('pot');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  useEffect(() => {
    if (initialIdeas) {
      setIdeas(initialIdeas);
    } else {
      loadIdeas();
    }
  }, [room.id, initialIdeas]);

  const loadIdeas = async () => {
    try {
      const fetched = await getRoomIdeas(room.id);
      setIdeas(fetched);
    } catch (err) {
      console.error('[HostDashboard] Failed to fetch ideas:', err);
    }
  };

  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(room.code);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleToggleIdeaStatus = async (ideaId: string, newStatus: 'pot' | 'archived') => {
    if (onToggleStatus) {
      onToggleStatus(ideaId, newStatus);
    } else {
      await toggleIdeaStatus(room.id, ideaId, newStatus);
    }

    setIdeas((prev) =>
      prev.map((idea) => (idea.id === ideaId ? { ...idea, status: newStatus } : idea))
    );
  };

  const potIdeas = ideas.filter((i) => i.status === 'pot');
  const activeIdeas = ideas.filter((i) => i.status === 'active');
  const archivedIdeas = ideas.filter((i) => i.status === 'archived');

  const currentTabIdeas =
    activeTab === 'pot' ? potIdeas : activeTab === 'active' ? activeIdeas : archivedIdeas;

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-6 text-mint animate-fadeIn">
      {/* Top Banner / Room Header */}
      <div className="p-6 rounded-2xl bg-surface border border-jade/30 shadow-jade-glow flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-well border border-jade/20 text-xs font-semibold text-jade flex items-center gap-1">
              <Shield className="w-3 h-3" /> HOST CURATION
            </span>
            <span className="text-xs text-mint/60">
              Leaderboard Limit: <strong className="text-mint font-mono-tabular">Top {room.leaderboardLimit}</strong>
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-mint-ivory">
            {room.name}
          </h1>
          {room.googleDoc?.lastSyncedAt && (
            <p className="text-xs text-mint/50">
              Last synced from Google Doc: {new Date(room.googleDoc.lastSyncedAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Room Code Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 p-2 px-3 rounded-xl bg-card border border-jade/30">
            <div className="text-right">
              <div className="text-[10px] uppercase font-semibold text-mint/50">Room Code</div>
              <div className="text-lg font-bold font-mono-tabular tracking-wider text-jade">
                {room.code}
              </div>
            </div>
            <button
              onClick={handleCopyCode}
              aria-label="Copy Room Code"
              className="p-1.5 rounded-lg bg-well hover:bg-well/80 text-mint/80 hover:text-jade transition-colors"
            >
              {copiedCode ? <Check className="w-4 h-4 text-jade" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Sync Button */}
          <button
            onClick={() => (onOpenDocSync ? onOpenDocSync() : setIsDocModalOpen(true))}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-jade hover:bg-jade-focus text-obsidian font-semibold transition-all shadow-md"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">Sync Google Doc</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Tabs */}
      <div
        role="tablist"
        aria-label="Idea curation categories"
        className="grid grid-cols-3 gap-3 p-1.5 bg-surface rounded-2xl border border-jade/20"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'pot'}
          onClick={() => setActiveTab('pot')}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all font-medium text-sm ${
            activeTab === 'pot'
              ? 'bg-card border border-jade/40 text-mint-ivory shadow-sm'
              : 'text-mint/60 hover:text-mint hover:bg-card/40'
          }`}
        >
          <Layers className="w-4 h-4 text-jade" />
          <span>The Pot</span>
          <span className="px-2 py-0.5 rounded-full bg-well text-xs font-mono-tabular text-jade">
            {potIdeas.length} in Pot
          </span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'active'}
          onClick={() => setActiveTab('active')}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all font-medium text-sm ${
            activeTab === 'active'
              ? 'bg-card border border-jade/40 text-mint-ivory shadow-sm'
              : 'text-mint/60 hover:text-mint hover:bg-card/40'
          }`}
        >
          <Flame className="w-4 h-4 text-rose" />
          <span>Active Challengers</span>
          <span className="px-2 py-0.5 rounded-full bg-well text-xs font-mono-tabular text-rose">
            {activeIdeas.length} Active
          </span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'archived'}
          onClick={() => setActiveTab('archived')}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all font-medium text-sm ${
            activeTab === 'archived'
              ? 'bg-card border border-jade/40 text-mint-ivory shadow-sm'
              : 'text-mint/60 hover:text-mint hover:bg-card/40'
          }`}
        >
          <Archive className="w-4 h-4 text-mint/40" />
          <span>Archived</span>
          <span className="px-2 py-0.5 rounded-full bg-well text-xs font-mono-tabular text-mint/60">
            {archivedIdeas.length} Archived
          </span>
        </button>
      </div>

      {/* Ideas List Section */}
      <div className="space-y-3">
        {currentTabIdeas.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-surface/50 border border-jade/20 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-card border border-jade/20 flex items-center justify-center text-mint/40">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-mint-ivory">
              No ideas in {activeTab === 'pot' ? 'the pot' : activeTab} yet
            </h3>
            <p className="text-xs text-mint/60 max-w-sm mx-auto">
              {activeTab === 'pot'
                ? 'Sync your Google Doc to populate new candidate ideas, or move archived ideas back into rotation.'
                : activeTab === 'active'
                ? 'Ideas currently being swiped on by raters in the King of the Hill arena appear here.'
                : 'Ideas you drop or archive will be kept here safely for future retrieval.'}
            </p>
            {activeTab === 'pot' && (
              <button
                onClick={() => (onOpenDocSync ? onOpenDocSync() : setIsDocModalOpen(true))}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-well hover:bg-well/80 border border-jade/30 text-xs text-jade font-medium transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Import Ideas via Google Doc</span>
              </button>
            )}
          </div>
        ) : (
          currentTabIdeas.map((idea) => {
            // Strip code prefix from title if present
            const cleanTitle = idea.title.replace(/^[A-Za-z0-9]+-\d+:\s*/, '');

            return (
              <div
                key={idea.id}
                className="p-5 rounded-2xl bg-card border border-jade/20 hover:border-jade/40 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-surface border border-jade/30 text-jade font-mono-tabular text-xs font-semibold">
                        ★ {idea.code}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-well text-mint/70 text-[11px] uppercase tracking-wider font-medium">
                        {idea.category}
                      </span>
                      {idea.score > 0 && (
                        <span className="text-xs font-mono-tabular text-mint/60">
                          Score: <strong className="text-mint">{idea.score}%</strong> ({idea.likesCount}L / {idea.passesCount}P)
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-mint-ivory">
                      {cleanTitle}
                    </h3>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {idea.status === 'pot' && (
                      <button
                        onClick={() => handleToggleIdeaStatus(idea.id, 'archived')}
                        aria-label={`Archive ${cleanTitle}`}
                        className="px-3 py-1.5 rounded-lg bg-well hover:bg-rose/10 border border-jade/20 hover:border-rose/30 text-xs text-mint/70 hover:text-rose transition-colors"
                      >
                        Archive
                      </button>
                    )}

                    {idea.status === 'archived' && (
                      <button
                        onClick={() => handleToggleIdeaStatus(idea.id, 'pot')}
                        aria-label={`Move ${cleanTitle} to Pot`}
                        className="px-3 py-1.5 rounded-lg bg-well hover:bg-jade/10 border border-jade/30 hover:border-jade text-xs text-jade font-medium transition-colors"
                      >
                        Move to Pot
                      </button>
                    )}

                    {idea.status === 'active' && (
                      <span className="px-2.5 py-1 rounded-lg bg-rose/10 border border-rose/30 text-rose text-xs font-medium">
                        Active in Arena
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-mint/80 leading-relaxed">
                  {idea.oneLiner}
                </p>

                {idea.problemStatement && (
                  <div className="text-[11px] text-mint/60 pt-2 border-t border-jade/10">
                    <strong className="text-mint/80">Problem:</strong> {idea.problemStatement}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Embedded Google Doc Import Modal */}
      <GoogleDocImportModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        roomId={room.id}
        currentDocId={room.googleDoc?.docId}
        onSynced={() => {
          loadIdeas();
        }}
      />
    </div>
  );
};
