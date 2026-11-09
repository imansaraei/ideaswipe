import React, { useState, useEffect } from 'react';
import { X, Sparkles, Clock, Hash, Loader2 } from 'lucide-react';
import { createRoom } from '../services/roomService';
import { Room, RoomSchedule } from '../types';

export interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated?: (room: Room) => void;
  hostUserId?: string;
}

const DAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onRoomCreated,
  hostUserId = 'anonymous_host',
}) => {
  const [name, setName] = useState('');
  const [leaderboardLimit, setLeaderboardLimit] = useState(3);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('18:00');
  const [scheduleDays, setScheduleDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setLeaderboardLimit(3);
      setScheduleEnabled(false);
      setScheduleTime('18:00');
      setScheduleDays([1, 2, 3, 4, 5]);
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleDay = (dayVal: number) => {
    setScheduleDays((prev) =>
      prev.includes(dayVal) ? prev.filter((d) => d !== dayVal) : [...prev, dayVal].sort()
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for the room');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let schedule: RoomSchedule | undefined = undefined;
      if (scheduleEnabled) {
        schedule = {
          enabled: true,
          time: scheduleTime,
          timezone,
          daysOfWeek: scheduleDays.length > 0 ? scheduleDays : [1, 2, 3, 4, 5],
        };
      }

      const room = await createRoom(hostUserId, name.trim(), leaderboardLimit, schedule);
      onRoomCreated?.(room);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create room. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-room-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/85 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg p-6 sm:p-8 bg-surface border border-jade/30 shadow-jade-glow rounded-2xl overflow-hidden transition-all text-mint max-h-[90vh] overflow-y-auto">
        {/* Holographic top accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-jade to-transparent" />

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-mint/70 hover:text-mint hover:bg-well/50 transition-colors focus:outline-none focus:ring-1 focus:ring-jade"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-well border border-jade/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-jade" />
            </div>
            <h2 id="create-room-modal-title" className="text-xl sm:text-2xl font-bold tracking-tight text-mint-ivory">
              Create New Room
            </h2>
          </div>
          <p className="text-sm text-mint/70">
            Set up a curated ideation room for your group with consensus rankings.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-rose/10 border border-rose/30 text-rose text-xs sm:text-sm font-medium"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Room Name */}
          <div>
            <label htmlFor="room-name-input" className="block text-xs uppercase tracking-wider text-mint/70 mb-1.5 font-medium">
              Room Name
            </label>
            <input
              id="room-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 Growth Brainstorm"
              disabled={isLoading}
              className="w-full px-4 py-2.5 bg-card border border-jade/30 rounded-xl text-mint placeholder-mint/30 focus:outline-none focus:border-jade focus:ring-1 focus:ring-jade transition-colors text-sm"
            />
          </div>

          {/* Leaderboard Size (N) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="room-limit-input" className="block text-xs uppercase tracking-wider text-mint/70 font-medium">
                Leaderboard Limit (N)
              </label>
              <span className="text-xs text-mint/50 font-mono-tabular">
                Top {leaderboardLimit} ideas survive
              </span>
            </div>
            <div className="relative">
              <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mint/50" />
              <input
                id="room-limit-input"
                type="number"
                min={1}
                max={20}
                value={leaderboardLimit}
                onChange={(e) => setLeaderboardLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-jade/30 rounded-xl text-mint font-mono-tabular focus:outline-none focus:border-jade focus:ring-1 focus:ring-jade transition-colors text-sm"
              />
            </div>
          </div>

          {/* Schedule Settings */}
          <div className="p-4 rounded-xl bg-well/40 border border-jade/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-jade" />
                <span className="text-sm font-medium text-mint">Daily Consensus Ping</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                  disabled={isLoading}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-card peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-obsidian after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-mint after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-jade"></div>
              </label>
            </div>

            {scheduleEnabled && (
              <div className="space-y-3 pt-2 border-t border-jade/10 animate-fadeIn">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="schedule-time" className="block text-[11px] uppercase tracking-wider text-mint/70 mb-1">
                      Time
                    </label>
                    <input
                      id="schedule-time"
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      disabled={isLoading}
                      className="w-full px-3 py-1.5 bg-card border border-jade/30 rounded-lg text-mint font-mono-tabular text-sm focus:outline-none focus:border-jade"
                    />
                  </div>

                  <div>
                    <label htmlFor="schedule-tz" className="block text-[11px] uppercase tracking-wider text-mint/70 mb-1">
                      Timezone
                    </label>
                    <input
                      id="schedule-tz"
                      type="text"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      disabled={isLoading}
                      className="w-full px-3 py-1.5 bg-card border border-jade/30 rounded-lg text-mint text-xs focus:outline-none focus:border-jade"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-mint/70 mb-1.5">
                    Days of Week
                  </label>
                  <div className="flex items-center gap-1.5">
                    {DAYS.map((day) => {
                      const isSelected = scheduleDays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          className={`flex-1 py-1 rounded-lg text-xs font-mono-tabular transition-all ${
                            isSelected
                              ? 'bg-jade text-obsidian font-semibold'
                              : 'bg-card border border-jade/20 text-mint/60 hover:text-mint'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="w-full flex items-center justify-center py-3 px-4 bg-jade hover:bg-jade-focus text-obsidian font-semibold rounded-xl transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-jade/50 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span>Create Room</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
