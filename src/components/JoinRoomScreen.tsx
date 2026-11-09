import React, { useState, useEffect, useCallback } from 'react';
import { LogIn, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { Room } from '../types';
import { getRoomByCode } from '../services/roomService';

export interface JoinRoomScreenProps {
  onJoinSuccess: (room: Room) => void;
  initialCode?: string;
  autoJoin?: boolean;
  onCancel?: () => void;
  onCreateRoom?: () => void;
  className?: string;
}

/**
 * Extracts and normalizes a 6-character room code from URL query params or invite paths.
 * Supports:
 * - https://domain.com/join?code=SWP402
 * - https://domain.com/?code=SWP402
 * - https://domain.com/join/SWP402
 * - /join/SWP402
 */
export function parseRoomCodeFromUrl(urlOrPath: string): string {
  if (!urlOrPath || typeof urlOrPath !== 'string') return '';

  try {
    // Check path for /join/:code
    const pathMatch = urlOrPath.match(/\/join\/([a-zA-Z0-9]{6})(?:[/?#]|$)/);
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1].toUpperCase();
    }

    // Check query params ?code=... or ?room=...
    let search = '';
    if (urlOrPath.includes('?')) {
      search = urlOrPath.split('?')[1]?.split('#')[0] || '';
    } else if (urlOrPath.startsWith('?')) {
      search = urlOrPath.slice(1);
    }

    if (search) {
      const params = new URLSearchParams(search);
      const codeParam = params.get('code') || params.get('room');
      if (codeParam && /^[a-zA-Z0-9]{6}$/.test(codeParam.trim())) {
        return codeParam.trim().toUpperCase();
      }
    }
  } catch {
    // Fallback if URL parsing fails
  }

  return '';
}

/**
 * Join Room Screen.
 * Allows entering 6-character room codes with monospace tabular digits,
 * automatic uppercase normalization, URL deep-link parsing, and room validation.
 */
export const JoinRoomScreen: React.FC<JoinRoomScreenProps> = ({
  onJoinSuccess,
  initialCode = '',
  autoJoin = false,
  onCancel,
  onCreateRoom,
  className = '',
}) => {
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Normalizes input to uppercase alphanumeric, maximum 6 characters
  const normalizeInput = (raw: string): string => {
    return raw
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
  };

  const handleValidateAndJoin = useCallback(
    async (codeToJoin: string) => {
      const cleanCode = normalizeInput(codeToJoin);
      if (cleanCode.length !== 6) {
        setErrorMessage('Room code must be exactly 6 characters.');
        return;
      }

      setLoading(true);
      setErrorMessage(null);

      try {
        const foundRoom = await getRoomByCode(cleanCode);
        if (foundRoom) {
          onJoinSuccess(foundRoom);
        } else {
          setErrorMessage('Room not found. Check the code and try again.');
        }
      } catch (err: any) {
        console.error('[JoinRoomScreen] Error verifying room code:', err);
        setErrorMessage(err?.message || 'Failed to verify room code. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [onJoinSuccess]
  );

  // Parse code from window.location or initialCode on mount
  useEffect(() => {
    let detectedCode = initialCode ? normalizeInput(initialCode) : '';

    if (!detectedCode && typeof window !== 'undefined' && window.location) {
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      const urlCode = parseRoomCodeFromUrl(currentUrl);
      if (urlCode) {
        detectedCode = urlCode;
      }
    }

    if (detectedCode) {
      setCode(detectedCode);
      if (autoJoin && detectedCode.length === 6) {
        handleValidateAndJoin(detectedCode);
      }
    }
  }, [initialCode, autoJoin, handleValidateAndJoin]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = normalizeInput(e.target.value);
    setCode(nextVal);
    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6 && !loading) {
      handleValidateAndJoin(code);
    }
  };

  const isSubmitDisabled = code.length !== 6 || loading;

  return (
    <div
      className={`w-full max-w-md mx-auto p-4 sm:p-6 text-mint animate-fadeIn ${className}`}
      data-testid="join-room-screen"
    >
      <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-jade/30 shadow-jade-glow space-y-6 relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-jade/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center space-y-2 relative z-10">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-card border border-jade/40 flex items-center justify-center text-jade shadow-sm">
            <LogIn className="w-6 h-6" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-well text-jade text-xs font-semibold uppercase tracking-wider border border-jade/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>IdeaSwipe Arena</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-mint-ivory">
            Join Idea Room
          </h1>
          <p className="text-xs text-mint/70 max-w-xs mx-auto leading-relaxed">
            Enter the 6-character code shared by your room host to start swiping on candidate ideas.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div className="space-y-2">
            <label
              htmlFor="room-code-input"
              className="block text-xs font-semibold uppercase tracking-wider text-mint/60 text-center"
            >
              Enter 6-Character Code
            </label>
            <input
              id="room-code-input"
              type="text"
              value={code}
              onChange={handleChange}
              placeholder="ROOM CODE"
              maxLength={6}
              autoComplete="off"
              autoFocus
              className="w-full text-center text-2xl font-bold font-mono-tabular tracking-widest uppercase py-3.5 px-4 rounded-xl bg-card border border-jade/40 focus:border-jade focus:outline-none focus:ring-2 focus:ring-jade/20 text-mint-ivory placeholder:text-mint/30 placeholder:tracking-normal placeholder:font-sans transition-all shadow-inner"
            />
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose/10 border border-rose/30 text-rose text-xs flex items-center gap-2 animate-fadeIn"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Button */}
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className={`w-full py-3.5 px-5 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all shadow-md ${
              isSubmitDisabled
                ? 'bg-well text-mint/40 border border-jade/10 cursor-not-allowed opacity-60'
                : 'bg-jade hover:bg-jade-focus text-obsidian shadow-jade-glow active:scale-98 cursor-pointer'
            }`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-obsidian border-t-transparent rounded-full animate-spin" />
                <span>Verifying Room...</span>
              </>
            ) : (
              <>
                <span>Join Room</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2 text-xs text-mint/60 hover:text-mint transition-colors text-center"
            >
              Cancel
            </button>
          )}

          {onCreateRoom && (
            <div className="pt-4 border-t border-jade/10 text-center relative z-10">
              <p className="text-xs text-mint/60 mb-2">Want to host your own idea session?</p>
              <button
                type="button"
                onClick={onCreateRoom}
                aria-label="Create New Room"
                className="px-4 py-2 rounded-xl bg-well hover:bg-well/80 border border-jade/30 hover:border-jade text-xs font-semibold text-jade transition-colors inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create a New Room</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
