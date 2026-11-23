import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Terminal } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { demoLogin, isSupabaseConfigured } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isSupabaseConfigured) {
      demoLogin(nickname || email.split('@')[0] || 'Player1', email.includes('admin') ? 'admin' : 'student');
      navigate('/dashboard');
      return;
    }

    try {
      if (isSignUp) {
        const { error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nickname: nickname || email.split('@')[0] } }
        });
        if (signUpErr) throw signUpErr;
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 grid grid-cols-1 lg:grid-cols-2 font-pixel">
      <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-orange-600 to-amber-700 text-white border-b lg:border-b-0 lg:border-r border-stone-800">
        <Terminal className="w-20 h-20 mb-6" />
        <h1 className="text-3xl md:text-4xl text-center leading-relaxed font-sans font-bold">ALGORITHM GO</h1>
        <p className="mt-6 text-xs text-orange-100 text-center max-w-sm leading-loose">
          INSERT CREDENTIALS TO INITIALIZE SESSION
        </p>
      </div>

      <div className="flex flex-col items-center justify-center p-8 md:p-16">
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
          <h2 className="text-xl text-orange-500 mb-6">
            {isSignUp ? 'NEW PLAYER' : 'PLAYER LOGIN'}
          </h2>

          {!isSupabaseConfigured && (
            <div className="p-3 bg-amber-950/60 border border-amber-600 text-amber-300 text-[10px] leading-relaxed">
              DEMO MODE ACTIVE: Add VITE_SUPABASE_URL in Netlify for live DB. Tip: include "admin" in email to test Admin view.
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-950 border border-rose-600 text-rose-300 text-[10px] leading-relaxed">
              {error}
            </div>
          )}

          {isSignUp && (
            <div>
              <label className="block text-xs text-stone-400 mb-2">NICKNAME</label>
              <input
                type="text"
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full bg-stone-900 border-2 border-stone-700 focus:border-orange-500 p-3 text-xs text-white outline-none font-sans"
                placeholder="ByteNinja"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-stone-400 mb-2">EMAIL</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-stone-900 border-2 border-stone-700 focus:border-orange-500 p-3 text-xs text-white outline-none font-sans"
              placeholder="player@domain.com"
            />
          </div>

          <div>
            <label className="block text-xs text-stone-400 mb-2">PASSWORD</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-stone-900 border-2 border-stone-700 focus:border-orange-500 p-3 text-xs text-white outline-none font-sans"
              placeholder="********"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white text-xs transition font-sans font-bold tracking-widest"
          >
            {loading ? 'LOADING...' : isSignUp ? 'CREATE ACCOUNT' : 'LOGIN ->'}
          </button>

          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-[10px] text-stone-400 hover:text-orange-400 pt-2 leading-loose"
          >
            {isSignUp ? 'ALREADY REGISTERED? LOGIN' : 'NEED AN ACCOUNT? REGISTER'}
          </button>
        </form>
      </div>
    </div>
  );
}
