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
  Shuffle,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { Room, Idea } from '../types';
import { getRoomIdeas, toggleIdeaStatus, shuffleRoom, getRoom, addIdea } from '../services/roomService';
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
  onRoomUpdated,
}) => {
  const [ideas, setIdeas] = useState<Idea[]>(initialIdeas || []);
  const [activeTab, setActiveTab] = useState<'pot' | 'active' | 'archived'>('pot');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [toastFeedback, setToastFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Manual Add Idea State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newOneLiner, setNewOneLiner] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newProblem, setNewProblem] = useState('');
  const [isSubmittingIdea, setIsSubmittingIdea] = useState(false);

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

  const handleShuffle = async () => {
    setIsShuffling(true);
    setToastFeedback(null);
    try {
      const result = await shuffleRoom(room.id);
      await loadIdeas();
      if (onRoomUpdated) {
        const updated = await getRoom(room.id);
        if (updated) onRoomUpdated(updated);
      }
      setToastFeedback({
        message: `Round started! Promoted ${result.champions.length} champion${result.champions.length === 1 ? '' : 's'} and selected ${result.nextChallengers.length} challenger${result.nextChallengers.length === 1 ? '' : 's'}.`,
        type: 'success',
      });
      setTimeout(() => setToastFeedback(null), 4000);
    } catch (err: any) {
      console.error('[HostDashboard] Shuffle failed:', err);
      setToastFeedback({
        message: err?.message || 'Failed to shuffle room ideas',
        type: 'error',
      });
      setTimeout(() => setToastFeedback(null), 4000);
    } finally {
      setIsShuffling(false);
    }
  };

  const handleAddIdeaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newOneLiner.trim()) return;

    setIsSubmittingIdea(true);
    try {
      const added = await addIdea(room.id, {
        title: newTitle.trim(),
        oneLiner: newOneLiner.trim(),
        category: newCategory.trim() || 'General',
        problemStatement: newProblem.trim() || undefined,
        status: 'pot',
      });

      setIdeas((prev) => [...prev, added]);
      setNewTitle('');
      setNewOneLiner('');
      setNewCategory('General');
      setNewProblem('');
      setIsAddModalOpen(false);
      setToastFeedback({
        message: `Added "${added.title}" to the pot!`,
        type: 'success',
      });
      setTimeout(() => setToastFeedback(null), 3000);
    } catch (err: any) {
      console.error('[HostDashboard] Failed to add idea:', err);
      setToastFeedback({
        message: err?.message || 'Failed to create idea',
        type: 'error',
      });
      setTimeout(() => setToastFeedback(null), 3000);
    } finally {
      setIsSubmittingIdea(false);
    }
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

        {/* Room Actions & Code Badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl bg-card border border-jade/30">
            <div className="text-right">
              <div className="text-[10px] uppercase font-semibold text-mint/50">Room Code</div>
              <div className="text-base font-bold font-mono-tabular tracking-wider text-jade">
                {room.code}
              </div>
            </div>
            <button
              onClick={handleCopyCode}
              aria-label="Copy Room Code"
              className="p-1.5 rounded-lg bg-well hover:bg-well/80 text-mint/80 hover:text-jade transition-colors active:scale-95 cursor-pointer"
            >
              {copiedCode ? <Check className="w-4 h-4 text-jade" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Add Idea Button */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-card hover:bg-well border border-jade/40 hover:border-jade text-mint font-semibold text-sm transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4 text-jade" />
            <span>Add Idea</span>
          </button>

          {/* Shuffle Button */}
          <button
            onClick={handleShuffle}
            disabled={isShuffling}
            aria-label="Shuffle Pot / Start Round"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-card hover:bg-well border border-jade/40 hover:border-jade text-mint-ivory hover:text-jade font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 cursor-pointer"
          >
            {isShuffling ? (
              <Loader2 className="w-4 h-4 text-jade animate-spin" />
            ) : (
              <Shuffle className="w-4 h-4 text-jade" />
            )}
            <span className="text-sm">
              {isShuffling ? 'Shuffling...' : 'Shuffle Round'}
            </span>
          </button>

          {/* Sync Button */}
          <button
            onClick={() => (onOpenDocSync ? onOpenDocSync() : setIsDocModalOpen(true))}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-jade hover:bg-jade-focus text-obsidian font-bold transition-all shadow-jade-glow active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm">Sync Doc</span>
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {toastFeedback && (
        <div
          role="status"
          className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 shadow-lg animate-fadeIn ${
            toastFeedback.type === 'success'
              ? 'bg-jade/10 border-jade/40 text-jade'
              : 'bg-rose/10 border-rose/40 text-rose'
          }`}
        >
          <span>{toastFeedback.message}</span>
          <button
            type="button"
            onClick={() => setToastFeedback(null)}
            className="p-1 hover:opacity-75 text-sm"
            aria-label="Close message"
          >
            &times;
          </button>
        </div>
      )}

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
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all font-medium text-sm active:scale-98 cursor-pointer ${
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
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all font-medium text-sm active:scale-98 cursor-pointer ${
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
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all font-medium text-sm active:scale-98 cursor-pointer ${
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
                ? 'Add ideas manually with the button above, sync a Google Doc, or move archived ideas back into rotation.'
                : activeTab === 'active'
                ? 'Ideas currently being swiped on by raters in the King of the Hill arena appear here.'
                : 'Ideas you drop or archive will be kept here safely for future retrieval.'}
            </p>
            {activeTab === 'pot' && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jade hover:bg-jade-focus text-obsidian text-xs font-bold transition-all shadow-jade-glow active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Idea</span>
                </button>
                <button
                  onClick={() => (onOpenDocSync ? onOpenDocSync() : setIsDocModalOpen(true))}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-well hover:bg-well/80 border border-jade/30 text-xs text-jade font-medium transition-colors active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Import via Google Doc</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          currentTabIdeas.map((idea) => {
            // Strip code prefix from title if present
            const cleanTitle = idea.title.replace(/^[A-Za-z0-9]+-\d+:\s*/, '');
            const formattedScore = idea.score <= 1 ? Math.round(idea.score * 100) : Math.round(idea.score);

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
                          Score: <strong className="text-mint">{formattedScore}%</strong> ({idea.likesCount}L / {idea.passesCount}P)
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
                        className="px-3 py-1.5 rounded-lg bg-well hover:bg-rose/10 border border-jade/20 hover:border-rose/30 text-xs text-mint/70 hover:text-rose transition-colors active:scale-95 cursor-pointer"
                      >
                        Archive
                      </button>
                    )}

                    {idea.status === 'archived' && (
                      <button
                        onClick={() => handleToggleIdeaStatus(idea.id, 'pot')}
                        aria-label={`Move ${cleanTitle} to Pot`}
                        className="px-3 py-1.5 rounded-lg bg-well hover:bg-jade/10 border border-jade/30 hover:border-jade text-xs text-jade font-medium transition-colors active:scale-95 cursor-pointer"
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

      {/* Manual Add Idea Modal */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-idea-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-sm animate-fadeIn"
        >
          <div className="w-full max-w-lg bg-surface border border-jade/40 rounded-2xl shadow-jade-glow p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-jade/20 pb-3">
              <h3 id="add-idea-modal-title" className="text-lg font-bold text-mint-ivory flex items-center gap-2">
                <Plus className="w-5 h-5 text-jade" />
                <span>Add Idea to Pot</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-well text-mint/60 hover:text-mint transition-colors active:scale-95 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddIdeaSubmit} className="space-y-4">
              <div>
                <label htmlFor="idea-title" className="block text-xs font-medium text-mint/80 mb-1">
                  Title *
                </label>
                <input
                  id="idea-title"
                  type="text"
                  required
                  placeholder="e.g. AI-Powered Calendar Shuffler"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-jade/30 text-sm text-mint-ivory placeholder-mint/30 focus:border-jade focus:outline-none focus:ring-1 focus:ring-jade/40"
                />
              </div>

              <div>
                <label htmlFor="idea-oneliner" className="block text-xs font-medium text-mint/80 mb-1">
                  One-Liner *
                </label>
                <textarea
                  id="idea-oneliner"
                  required
                  rows={2}
                  placeholder="Crisp single sentence describing the concept..."
                  value={newOneLiner}
                  onChange={(e) => setNewOneLiner(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-jade/30 text-sm text-mint-ivory placeholder-mint/30 focus:border-jade focus:outline-none focus:ring-1 focus:ring-jade/40"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="idea-category" className="block text-xs font-medium text-mint/80 mb-1">
                    Category
                  </label>
                  <input
                    id="idea-category"
                    type="text"
                    placeholder="General, Tech, Growth..."
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-card border border-jade/30 text-sm text-mint-ivory placeholder-mint/30 focus:border-jade focus:outline-none focus:ring-1 focus:ring-jade/40"
                  />
                </div>
                <div>
                  <label htmlFor="idea-problem" className="block text-xs font-medium text-mint/80 mb-1">
                    Problem (Optional)
                  </label>
                  <input
                    id="idea-problem"
                    type="text"
                    placeholder="Why does this matter?"
                    value={newProblem}
                    onChange={(e) => setNewProblem(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-card border border-jade/30 text-sm text-mint-ivory placeholder-mint/30 focus:border-jade focus:outline-none focus:ring-1 focus:ring-jade/40"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-jade/20">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-well text-mint/70 hover:text-mint text-xs font-medium transition-colors active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIdea || !newTitle.trim() || !newOneLiner.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jade hover:bg-jade-focus disabled:opacity-50 text-obsidian text-xs font-bold transition-all shadow-jade-glow active:scale-95 cursor-pointer"
                >
                  {isSubmittingIdea ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Add Idea</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
