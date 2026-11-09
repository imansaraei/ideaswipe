import React from 'react';
import {
  Crown,
  Users,
  Sparkles,
  ArrowLeft,
  FileQuestion,
} from 'lucide-react';
import { Idea, Room } from '../types';
import { rankLeaderboardIdeas } from '../lib/leaderboard';
import { useRoomData } from '../hooks/useRoomData';

export interface LeaderboardViewProps {
  roomId: string;
  limit?: number;
  initialRoom?: Room;
  initialIdeas?: Idea[];
  participantCount?: number;
  totalVotes?: number;
  onBack?: () => void;
  onSelectIdea?: (idea: Idea) => void;
  className?: string;
}

/**
 * Formats vote metrics into tabular monospace string: e.g. "100% (4/4 Yes)".
 */
export function formatConsensusMetric(likesCount: number, passesCount: number): string {
  const likes = likesCount || 0;
  const passes = passesCount || 0;
  const total = likes + passes;
  const percentage = total > 0 ? Math.round((likes / total) * 100) : 0;
  return `${percentage}% (${likes}/${total} Yes)`;
}

/**
 * Real-time King of the Hill Leaderboard.
 * Displays top N champion ideas ranked by consensus percentage with animated progress bars,
 * crown/trophy badges, tabular monospace metrics, and participant counts.
 */
export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  roomId,
  limit = 3,
  initialRoom,
  initialIdeas,
  participantCount: propParticipantCount,
  totalVotes: propTotalVotes,
  onBack,
  onSelectIdea,
  className = '',
}) => {
  const {
    room: hookRoom,
    ideas: hookIdeas,
    participantCount: hookParticipantCount,
    totalVotes: hookTotalVotes,
    loading,
  } = useRoomData(initialRoom ? null : roomId, limit);

  const room = initialRoom || hookRoom;
  const rawIdeas = initialIdeas || hookIdeas;

  const effectiveParticipantCount = propParticipantCount ?? hookParticipantCount ?? 0;
  const effectiveTotalVotes = propTotalVotes ?? hookTotalVotes ?? 0;

  const rankedChampions = rankLeaderboardIdeas(rawIdeas, limit);

  return (
    <div
      className={`w-full max-w-2xl mx-auto p-4 sm:p-6 space-y-6 text-mint animate-fadeIn ${className}`}
      data-testid="leaderboard-view"
    >
      {/* Top Banner / Room Status */}
      <div className="p-6 rounded-2xl bg-surface border border-jade/30 shadow-jade-glow relative overflow-hidden">
        {/* Glow ambient background element */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-jade/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="p-1 rounded-lg bg-well hover:bg-well/80 text-mint/70 hover:text-jade transition-colors mr-1"
                  aria-label="Go Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <span className="px-2.5 py-0.5 rounded-full bg-well border border-jade/20 text-xs font-semibold text-jade flex items-center gap-1.5 shadow-sm">
                <Crown className="w-3.5 h-3.5 text-yellow-400" />
                <span>KING OF THE HILL</span>
              </span>
              <span className="text-xs text-mint/60">
                Top <strong className="text-mint font-mono-tabular">{limit}</strong> Champions
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight text-mint-ivory flex items-center gap-2">
              <span>{room?.name || 'Idea Arena Leaderboard'}</span>
            </h1>

            {room?.code && (
              <p className="text-xs text-mint/60 flex items-center gap-1.5">
                <span>Room Code:</span>
                <span className="font-mono-tabular font-bold text-jade px-1.5 py-0.5 rounded bg-card border border-jade/20">
                  {room.code}
                </span>
              </p>
            )}
          </div>

          {/* Member Participation Stat Pill */}
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-card border border-jade/30 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-well flex items-center justify-center text-jade">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-semibold text-mint/50">Participation</div>
                <div data-testid="participation-stats" className="text-xs font-mono-tabular font-medium text-mint-ivory">
                  <span>{effectiveParticipantCount} members</span>
                  {effectiveTotalVotes > 0 && (
                    <span className="text-mint/60"> • {effectiveTotalVotes} votes</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Champion Ranking Stack */}
      <div className="space-y-3">
        {loading && !initialIdeas && (
          <div className="p-8 text-center rounded-2xl bg-surface/50 border border-jade/20 space-y-2">
            <div className="w-8 h-8 mx-auto border-2 border-jade border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-mint/60 font-mono-tabular">Calculating consensus standings...</p>
          </div>
        )}

        {rankedChampions.length === 0 && !loading ? (
          <div className="p-12 text-center rounded-2xl bg-surface/50 border border-jade/20 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-card border border-jade/20 flex items-center justify-center text-mint/40">
              <FileQuestion className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-mint-ivory">
              No ideas ranked yet
            </h3>
            <p className="text-xs text-mint/60 max-w-sm mx-auto leading-relaxed">
              Cast your votes in the arena to crown the first King of the Hill champions.
              Top ideas with highest consensus will reign here.
            </p>
          </div>
        ) : (
          rankedChampions.map((idea, index) => {
            const rank = index + 1;
            const isCrown = rank === 1;
            const likes = idea.likesCount || 0;
            const passes = idea.passesCount || 0;
            const total = likes + passes;
            const percent = total > 0 ? Math.round((likes / total) * 100) : Math.round((idea.score || 0) * 100);
            const metricString = formatConsensusMetric(likes, passes);

            return (
              <div
                key={idea.id}
                onClick={() => onSelectIdea?.(idea)}
                className={`p-5 rounded-2xl transition-all border relative overflow-hidden ${
                  isCrown
                    ? 'bg-gradient-to-r from-[#0c2018] via-[#091b14] to-[#040e0a] border-jade/50 shadow-jade-glow'
                    : 'bg-card border-jade/20 hover:border-jade/40'
                } ${onSelectIdea ? 'cursor-pointer' : ''}`}
              >
                {/* Header Row: Rank Badge, Title, Monospace Percentage */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-3">
                    {/* Rank Badge */}
                    <div
                      data-testid={`rank-badge-${rank}`}
                      className={`flex items-center justify-center w-8 h-8 rounded-xl font-mono-tabular font-bold text-sm ${
                        isCrown
                          ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 shadow-sm'
                          : rank === 2
                          ? 'bg-slate-300/10 text-slate-200 border border-slate-300/30'
                          : rank === 3
                          ? 'bg-amber-700/20 text-amber-300 border border-amber-600/30'
                          : 'bg-well text-mint/70 border border-jade/20'
                      }`}
                    >
                      {isCrown ? (
                        <Crown className="w-4 h-4 text-yellow-400" />
                      ) : (
                        `#${rank}`
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-surface border border-jade/30 text-jade font-mono-tabular text-[11px] font-semibold">
                          ★ {idea.code}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-well text-mint/70 text-[10px] uppercase tracking-wider">
                          {idea.category}
                        </span>
                        {isCrown && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-400 uppercase tracking-wider">
                            <Sparkles className="w-3 h-3" /> Champion
                          </span>
                        )}
                      </div>
                      <h2 className="text-base font-bold text-mint-ivory mt-0.5">
                        {idea.title.replace(/^[A-Za-z0-9]+-\d+:\s*/, '')}
                      </h2>
                    </div>
                  </div>

                  {/* Percentage in Tabular Monospace */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold font-mono-tabular text-jade">
                      {metricString}
                    </div>
                    <div className="text-[10px] font-mono-tabular text-mint/50">
                      {likes} Yes • {passes} Pass
                    </div>
                  </div>
                </div>

                {/* One Liner */}
                <p className="text-xs text-mint/80 mb-3 leading-relaxed">
                  {idea.oneLiner}
                </p>

                {/* Animated Progress Bar */}
                <div className="w-full h-2 rounded-full bg-obsidian border border-jade/20 overflow-hidden relative">
                  <div
                    data-testid="consensus-progress-bar"
                    className="h-full bg-jade transition-all duration-500 rounded-full"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
