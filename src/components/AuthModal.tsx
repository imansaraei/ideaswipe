import React, { useState, useEffect } from 'react';
import { type User } from 'firebase/auth';
import { X, Mail, KeyRound, Loader2, ArrowLeft } from 'lucide-react';
import { signInWithGoogle, requestEmailOtp, verifyEmailOtp } from '../services/auth';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: User) => void;
  title?: string;
  description?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Join the Consensus',
  description = 'Sign in to swipe on ideas and view group leaderboards.',
}) => {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('email');
      setEmail('');
      setOtpCode('');
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

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      onSuccess?.(user);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await requestEmailOtp(email.trim());
      setStep('otp');
    } catch (err: any) {
      setError(err?.message || 'Failed to send verification code. Please check your email.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const user = await verifyEmailOtp(email.trim(), otpCode.trim());
      onSuccess?.(user);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/85 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md p-6 sm:p-8 bg-surface border border-jade/30 shadow-jade-glow rounded-2xl overflow-hidden transition-all text-mint">
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
        <div className="text-center mb-6">
          <h2 id="auth-modal-title" className="text-xl sm:text-2xl font-bold tracking-tight text-mint-ivory">
            {title}
          </h2>
          <p className="mt-1.5 text-sm text-mint/70">{description}</p>
        </div>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="mb-5 p-3 rounded-xl bg-rose/10 border border-rose/30 text-rose text-xs sm:text-sm font-medium animate-fadeIn"
          >
            {error}
          </div>
        )}

        {/* Step: Email Form */}
        {step === 'email' ? (
          <div className="space-y-4">
            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center px-4 py-3 bg-well/60 hover:bg-well border border-jade/30 hover:border-jade text-mint font-medium rounded-xl transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-jade/50 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-jade" />
              ) : (
                <>
                  <svg className="w-5 h-5 mr-3 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 12s.7 2.3 1.9 4.7l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-jade/20 w-full" />
              <span className="bg-surface px-3 text-xs uppercase tracking-wider text-mint/50 font-mono-tabular">
                or email code
              </span>
              <div className="border-t border-jade/20 w-full" />
            </div>

            {/* Email OTP Request Form */}
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label htmlFor="auth-email-input" className="block text-xs uppercase tracking-wider text-mint/70 mb-1.5 font-medium">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mint/50" />
                  <input
                    id="auth-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-2.5 bg-card border border-jade/30 rounded-xl text-mint placeholder-mint/30 focus:outline-none focus:border-jade focus:ring-1 focus:ring-jade transition-colors text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center py-3 px-4 bg-jade hover:bg-jade-focus text-obsidian font-semibold rounded-xl transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-jade/50 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span>Send 6-Digit Code</span>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Step: OTP Verification Form */
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="auth-otp-input" className="block text-xs uppercase tracking-wider text-mint/70 font-medium">
                  Verification Code
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setError(null);
                  }}
                  className="flex items-center text-xs text-jade hover:text-jade-focus transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  <span>Change email</span>
                </button>
              </div>

              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mint/50" />
                <input
                  id="auth-otp-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  autoFocus
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 bg-card border border-jade/30 rounded-xl text-mint placeholder-mint/30 font-mono-tabular text-xl tracking-[0.4em] text-center focus:outline-none focus:border-jade focus:ring-1 focus:ring-jade transition-colors"
                />
              </div>
              <p className="mt-2 text-xs text-center text-mint/60">
                Code sent to <span className="text-mint font-medium">{email}</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || otpCode.length !== 6}
              className="w-full flex items-center justify-center py-3 px-4 bg-jade hover:bg-jade-focus text-obsidian font-semibold rounded-xl transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-jade/50 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span>Verify & Sign In</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
