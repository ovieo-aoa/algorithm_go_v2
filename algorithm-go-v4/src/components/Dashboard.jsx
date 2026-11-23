import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { GAMES_CONFIG } from '../lib/gamesConfig';
import { Trophy, Zap, Lock, ArrowUpRight, LogOut, ShieldAlert, CheckCircle2, Code2 } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [progress, setProgress] = useState([]);
  const [dbGames, setDbGames] = useState([]);

  useEffect(() => {
    if (!isSupabaseConfigured || !user || user.id === 'demo-id') return;
    
    // Fetch user progress
    supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => { if (data) setProgress(data); });
      
    // Fetch live game status from DB (Flaw 2 Fix: Dynamic Config)
    supabase
      .from('games')
      .select('id, is_active')
      .then(({ data }) => { if (data) setDbGames(data); });
  }, [user]);

  const solvedCount = progress.filter((p) => p.is_solved).length;
  const bestSpeed = progress.find((p) => p.best_execution_ms)?.best_execution_ms;

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans">
      <nav className="sticky top-0 z-40 bg-stone-950/85 backdrop-blur-md border-b border-stone-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-orange-600 p-2 rounded-lg">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight">ALGORITHM GO</span>
          </div>

          <div className="flex items-center gap-4">
            {profile?.role === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-2 bg-amber-500/15 text-amber-400 border border-amber-500/40 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-500/25 transition"
              >
                <ShieldAlert className="w-4 h-4" />
                Admin Panel
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-stone-400 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        <section className="rounded-3xl bg-gradient-to-r from-stone-900 via-stone-900 to-orange-950/40 border border-stone-800 p-8 md:p-12">
          <h1 className="text-4xl md:text-6xl font-extrabold uppercase tracking-tight">
            WELCOME <span className="text-orange-500">{profile?.nickname || 'PLAYER'}</span>
          </h1>
          <p className="mt-3 text-stone-400 text-lg">
            Select a module below to write and verify your algorithm.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 flex items-center gap-5">
            <div className="p-4 rounded-xl bg-orange-500/10 text-orange-500">
              <Trophy className="w-8 h-8" />
            </div>
            <div>
              <p className="text-stone-400 text-sm">Problems Solved</p>
              <p className="text-3xl font-extrabold mt-1">
                {solvedCount} <span className="text-lg text-stone-500 font-normal">/ {GAMES_CONFIG.length}</span>
              </p>
            </div>
          </div>

          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 flex items-center gap-5">
            <div className="p-4 rounded-xl bg-amber-500/10 text-amber-500">
              <Zap className="w-8 h-8" />
            </div>
            <div>
              <p className="text-stone-400 text-sm">Fastest Verification Run</p>
              <p className="text-3xl font-extrabold mt-1">
                {bestSpeed ? `${bestSpeed.toFixed(1)} ms` : '--'}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-8 pb-16">
          {GAMES_CONFIG.map((game) => {
            const dbOverride = dbGames.find(g => g.id === game.id);
            const isActuallyActive = dbOverride ? dbOverride.is_active : game.fallbackIsActive;
            const isSolved = progress.some((p) => p.game_id === game.id && p.is_solved);
            const canOpen = isActuallyActive || profile?.role === 'admin';

            return (
              <div
                key={game.id}
                onClick={() => canOpen && navigate(`/arena/${game.id}`)}
                className={`group relative overflow-hidden rounded-3xl border-2 ${game.border} bg-gradient-to-br ${game.gradient} shadow-2xl transition-all duration-300 ${
                  canOpen ? 'cursor-pointer hover:-translate-y-1' : 'cursor-not-allowed'
                }`}
              >
                <div
                  className="absolute inset-0 opacity-60 pointer-events-none"
                  style={{ backgroundImage: game.pattern, backgroundSize: game.patternSize }}
                />

                {!isActuallyActive && (
                  <div className="absolute inset-0 z-20 bg-stone-950/75 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center">
                    <div className="bg-stone-900/95 border border-stone-700 px-6 py-3 rounded-2xl flex items-center gap-3">
                      <Lock className="w-6 h-6 text-stone-400" />
                      <span className="font-mono text-xl font-bold tracking-widest text-stone-200 uppercase">
                        In Progress
                      </span>
                    </div>
                    {profile?.role === 'admin' && (
                      <span className="mt-2 text-xs font-mono text-amber-400">
                        Admin Override: Click to test preview
                      </span>
                    )}
                  </div>
                )}

                <div className="relative z-10 flex flex-col md:flex-row items-stretch min-h-[240px]">
                  <div className="md:w-1/3 bg-stone-900 overflow-hidden">
                    <img
                      src={game.image}
                      alt={game.title}
                      className="w-full h-56 md:h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="md:w-2/3 p-8 md:p-10 flex flex-col justify-between text-white">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2 group-hover:underline">
                          {game.title}
                          {canOpen && <ArrowUpRight className="w-7 h-7" />}
                        </h3>
                        {isSolved && (
                          <span className="flex items-center gap-1.5 bg-black/35 px-3 py-1 rounded-full text-sm font-semibold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-300" /> Solved
                          </span>
                        )}
                      </div>
                      <p className="mt-4 text-lg md:text-xl text-white/95 font-semibold leading-relaxed">
                        {game.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
