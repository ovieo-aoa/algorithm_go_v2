import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Terminal,
  Mail,
  Lock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Countdown timer for the Resend Email button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleModeSwitch = (signUpMode) => {
    setIsSignUp(signUpMode);
    setError('');
    setInfoMessage('');
    setNeedsConfirmation(false);
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      setError('Enter your email address above first so we know where to resend the link.');
      return;
    }
    if (resending || resendCooldown > 0) return;

    setResending(true);
    setError('');

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/login`
      }
    });

    setResending(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setInfoMessage(`A new confirmation link has been sent to ${email.trim()}. Check your inbox and spam folder.`);
    setResendCooldown(60);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setNeedsConfirmation(false);

    if (!isSupabaseConfigured) {
      navigate('/dashboard');
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim() || cleanEmail.split('@')[0],
              role: 'student'
            },
            emailRedirectTo: `${window.location.origin}/login`
          }
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        // Supabase returns empty identities when the email already exists
        if (data?.user?.identities?.length === 0) {
          setError('An account with this email already exists. Switch to Sign In instead.');
          return;
        }

        // Email confirmation enabled -> session is null until verified
        if (data?.user && !data?.session) {
          setInfoMessage(
            `Confirmation email sent to ${cleanEmail}. Click the verification link in your inbox (check spam too) before signing in.`
          );
          setNeedsConfirmation(true);
          setResendCooldown(60);
          setIsSignUp(false);
          setPassword('');
          return;
        }

        // If email confirmation is disabled in Supabase, session exists immediately
        if (data?.session) {
          navigate('/dashboard', { replace: true });
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        });

        if (signInError) {
          if (signInError.message.toLowerCase().includes('email not confirmed')) {
            setError('Your email address has not been confirmed yet.');
            setNeedsConfirmation(true);
          } else {
            setError(signInError.message);
          }
          return;
        }

        if (data?.session) {
          navigate('/dashboard', { replace: true });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-stone-950 text-stone-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Top Brand Header */}
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 px-8 py-7 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-black/25 rounded-xl">
              <Terminal className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight uppercase">Algorithm Go</h1>
          </div>
          <p className="text-orange-100 text-sm">
            {isSignUp
              ? 'Create a student account to track your arena progress.'
              : 'Sign in to enter the programming arenas.'}
          </p>
        </div>

        <div className="p-8 space-y-6">
          {/* Sign In / Sign Up Tabs */}
          <div className="grid grid-cols-2 bg-stone-950 p-1 rounded-xl border border-stone-800">
            <button
              type="button"
              onClick={() => handleModeSwitch(false)}
              className={`py-2 text-sm font-bold rounded-lg transition ${
                !isSignUp
                  ? 'bg-orange-600 text-white shadow'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch(true)}
              className={`py-2 text-sm font-bold rounded-lg transition ${
                isSignUp
                  ? 'bg-orange-600 text-white shadow'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Confirmation Sent Banner */}
          {infoMessage && (
            <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-sm flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="leading-relaxed">{infoMessage}</p>
                {needsConfirmation && (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={resending || resendCooldown > 0}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:text-white disabled:opacity-50 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                    {resendCooldown > 0
                      ? `Resend email in ${resendCooldown}s`
                      : 'Resend confirmation email'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="leading-relaxed">{error}</p>
                {needsConfirmation && (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={resending || resendCooldown > 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-900/80 hover:bg-rose-800 text-xs font-bold text-white disabled:opacity-50 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                    {resendCooldown > 0
                      ? `Resend available in ${resendCooldown}s`
                      : 'Resend confirmation email'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full bg-stone-950 border border-stone-800 focus:border-orange-500 rounded-xl pl-10 pr-4 py-3 text-sm text-stone-100 placeholder-stone-600 outline-none transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@school.edu"
                  className="w-full bg-stone-950 border border-stone-800 focus:border-orange-500 rounded-xl pl-10 pr-4 py-3 text-sm text-stone-100 placeholder-stone-600 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-stone-950 border border-stone-800 focus:border-orange-500 rounded-xl pl-10 pr-4 py-3 text-sm text-stone-100 placeholder-stone-600 outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                <>
                  {isSignUp ? 'Create Account' : 'Enter Arena'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {!isSupabaseConfigured && (
            <p className="text-center text-xs text-amber-400/90">
              Supabase keys not detected — submitting enters Demo Mode.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
