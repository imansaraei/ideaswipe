import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  FileSpreadsheet,
  ArrowRight,
  Loader2,
  AlertCircle,
  Download,
} from 'lucide-react';
import { syncGoogleSheet } from '../services/roomService';
import {
  BLANK_SHEET_TEMPLATE_CSV,
  downloadBlankSheetTemplate,
  extractSheetIdFromUrl,
} from '../lib/sheetParser';

export interface GoogleDocImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  onSynced?: (count: number) => void;
  currentDocId?: string;
}

export const GoogleDocImportModal: React.FC<GoogleDocImportModalProps> = ({
  isOpen,
  onClose,
  roomId,
  onSynced,
  currentDocId = '',
}) => {
  const [sheetInput, setSheetInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [manualCsv, setManualCsv] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSheetInput(
        currentDocId && currentDocId !== 'manual-sheet'
          ? `https://docs.google.com/spreadsheets/d/${currentDocId}/edit`
          : ''
      );
      setCopied(false);
      setError(null);
      setSuccessCount(null);
      setIsLoading(false);
      setManualCsv('');
      setShowManualPaste(false);
    }
  }, [isOpen, currentDocId]);

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

  const handleCopyTemplate = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(BLANK_SHEET_TEMPLATE_CSV);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetInput.trim() && !manualCsv.trim()) {
      setError('Please provide a Google Sheet URL or paste CSV rows directly.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessCount(null);

    try {
      const sheetId = extractSheetIdFromUrl(sheetInput.trim()) || 'manual-sheet';
      const count = await syncGoogleSheet(roomId, sheetId, manualCsv.trim() || undefined);
      setSuccessCount(count);
      onSynced?.(count);

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setError(
        err?.message ||
          'Failed to sync Google Sheet. Ensure sharing is set to "Anyone with the link" or use manual CSV paste.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-sheet-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-surface border border-jade/30 shadow-jade-glow p-6 text-mint space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-jade/20 pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-jade" />
            <h2 id="sync-sheet-modal-title" className="text-xl font-bold text-mint-ivory">
              Sync with Google Sheet
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg hover:bg-well text-mint/60 hover:text-mint transition-colors active:scale-95 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-mint/70 leading-relaxed">
          Share a 5-column Google Sheet (<strong className="text-mint">no</strong>,{' '}
          <strong className="text-mint">One-liner Description</strong>,{' '}
          <strong className="text-mint">Full Description</strong>,{' '}
          <strong className="text-mint">Further Read/Listen</strong>,{' '}
          <strong className="text-mint">Pot</strong>) with{' '}
          <em className="text-jade">&ldquo;Anyone with the link&rdquo;</em> access.
        </p>

        {/* Template Actions */}
        <div className="p-3.5 rounded-xl bg-card border border-jade/20 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-medium text-mint/80">Need a blank 5-column template?</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadBlankSheetTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-well hover:bg-well/80 border border-jade/30 text-xs font-semibold text-jade transition-colors active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Blank CSV</span>
            </button>
            <button
              type="button"
              onClick={handleCopyTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-well hover:bg-well/80 border border-jade/30 text-xs font-semibold text-mint transition-colors active:scale-95 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-jade" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Template'}</span>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSync} className="space-y-4">
          <div>
            <label htmlFor="sheet-url-input" className="block text-xs font-medium text-mint/80 mb-1.5">
              Google Sheet URL or ID
            </label>
            <input
              id="sheet-url-input"
              type="text"
              value={sheetInput}
              onChange={(e) => setSheetInput(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-jade/30 text-sm text-mint-ivory placeholder-mint/30 focus:border-jade focus:outline-none focus:ring-1 focus:ring-jade/40"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowManualPaste(!showManualPaste)}
            className="text-xs text-jade hover:underline cursor-pointer"
          >
            {showManualPaste ? 'Hide manual CSV paste' : 'Or paste CSV rows directly'}
          </button>

          {showManualPaste && (
            <textarea
              rows={4}
              value={manualCsv}
              onChange={(e) => setManualCsv(e.target.value)}
              placeholder={BLANK_SHEET_TEMPLATE_CSV}
              className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-jade/30 text-xs font-mono-tabular text-mint-ivory placeholder-mint/30 focus:border-jade focus:outline-none"
            />
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose/10 border border-rose/30 text-xs text-rose flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="p-3 rounded-xl bg-jade/10 border border-jade/40 text-xs text-jade font-medium">
              Synced {successCount} idea{successCount === 1 ? '' : 's'} from Google Sheet!
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-jade/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-well text-mint/70 hover:text-mint text-xs font-medium transition-colors active:scale-95 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-jade hover:bg-jade-focus disabled:opacity-50 text-obsidian text-xs font-bold transition-all shadow-jade-glow active:scale-95 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <span>Sync Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
