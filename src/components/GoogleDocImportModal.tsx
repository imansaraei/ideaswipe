import React, { useState, useEffect } from 'react';
import { X, Copy, Check, FileText, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { syncGoogleDoc, GOOGLE_DOC_MARKDOWN_TEMPLATE, extractDocIdFromUrl } from '../services/roomService';

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
  const [docInput, setDocInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [manualMarkdown, setManualMarkdown] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDocInput(currentDocId ? `https://docs.google.com/document/d/${currentDocId}/edit` : '');
      setCopied(false);
      setError(null);
      setSuccessCount(null);
      setIsLoading(false);
      setManualMarkdown('');
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
        await navigator.clipboard.writeText(GOOGLE_DOC_MARKDOWN_TEMPLATE);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docInput.trim() && !manualMarkdown.trim()) {
      setError('Please provide a Google Doc URL or paste markdown content directly.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessCount(null);

    try {
      const docId = extractDocIdFromUrl(docInput.trim()) || 'manual_doc';
      const count = await syncGoogleDoc(roomId, docId, manualMarkdown.trim() || undefined);
      setSuccessCount(count);
      onSynced?.(count);

      // Brief delay so user sees success message, then close
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setError(
        err?.message ||
          'Failed to sync Google Doc. Please check permissions (Anyone with the link can view) or use manual paste.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-import-modal-title"
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
              <FileText className="w-4 h-4 text-jade" />
            </div>
            <h2 id="doc-import-modal-title" className="text-xl sm:text-2xl font-bold tracking-tight text-mint-ivory">
              Sync with Google Doc
            </h2>
          </div>
          <p className="text-sm text-mint/70">
            Import your ideas pool directly from a Google Doc using the markdown consensus schema.
          </p>
        </div>

        {/* Template Copy Card */}
        <div className="mb-6 p-4 rounded-xl bg-card border border-jade/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-mint-ivory uppercase tracking-wider">
              Markdown Schema Template
            </span>
            <button
              type="button"
              onClick={handleCopyTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-well hover:bg-well/80 border border-jade/30 text-xs font-medium text-jade hover:text-jade-focus transition-all shadow-sm"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-jade" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Template</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-2.5 rounded-lg bg-obsidian border border-jade/10 font-mono-tabular text-[11px] text-mint/80 overflow-x-auto leading-relaxed">
            {GOOGLE_DOC_MARKDOWN_TEMPLATE}
          </pre>
          <p className="text-[11px] text-mint/50">
            Format each idea with <code className="text-jade">### ★ I-xxx Title</code> and bullet points for Status, One-liner, Category, Problem, and Next step.
          </p>
        </div>

        {/* Feedback / Alerts */}
        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-rose/10 border border-rose/30 text-rose text-xs sm:text-sm font-medium flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successCount !== null && (
          <div
            role="status"
            className="mb-4 p-3 rounded-xl bg-jade/10 border border-jade/40 text-jade text-xs sm:text-sm font-medium flex items-center gap-2"
          >
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>Successfully synced {successCount} ideas into the pot!</span>
          </div>
        )}

        {/* Sync Form */}
        <form onSubmit={handleSync} className="space-y-4">
          <div>
            <label htmlFor="doc-url-input" className="block text-xs uppercase tracking-wider text-mint/70 mb-1.5 font-medium">
              Google Doc URL or ID
            </label>
            <input
              id="doc-url-input"
              type="text"
              value={docInput}
              onChange={(e) => setDocInput(e.target.value)}
              placeholder="https://docs.google.com/document/d/.../edit"
              disabled={isLoading}
              className="w-full px-4 py-2.5 bg-card border border-jade/30 rounded-xl text-mint placeholder-mint/30 focus:outline-none focus:border-jade focus:ring-1 focus:ring-jade transition-colors text-sm font-mono-tabular"
            />
            <p className="mt-1 text-[11px] text-mint/50">
              Ensure link sharing is set to <span className="text-jade">"Anyone with the link can view"</span>.
            </p>
          </div>

          {/* Toggle manual text fallback */}
          <div>
            <button
              type="button"
              onClick={() => setShowManualPaste(!showManualPaste)}
              className="text-xs text-jade/80 hover:text-jade transition-colors underline underline-offset-2"
            >
              {showManualPaste ? 'Hide direct markdown paste' : 'Or paste document markdown directly'}
            </button>

            {showManualPaste && (
              <div className="mt-2 animate-fadeIn">
                <textarea
                  rows={4}
                  value={manualMarkdown}
                  onChange={(e) => setManualMarkdown(e.target.value)}
                  placeholder="Paste markdown content starting with ### ★ I-001..."
                  disabled={isLoading}
                  className="w-full p-3 bg-card border border-jade/30 rounded-xl text-mint placeholder-mint/30 text-xs font-mono-tabular focus:outline-none focus:border-jade"
                />
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || (!docInput.trim() && !manualMarkdown.trim())}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-jade hover:bg-jade-focus text-obsidian font-semibold rounded-xl transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-jade/50 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Sync Now</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
