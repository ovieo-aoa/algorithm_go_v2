import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { GAMES_CONFIG } from '../lib/gamesConfig';
import { ShieldAlert, Play, ArrowLeft, Unlock, Lock } from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [students, setStudents] = useState([]);
  const [dbGames, setDbGames] = useState([]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setStudents([{ id: '1', nickname: 'DemoStudent1', role: 'student', solvedCount: 1 }]);
      return;
    }

    async function loadAdminData() {
      const { data: profiles } = await supabase.from('profiles').select('*');
      const { data: prog } = await supabase.from('user_progress').select('*');
      const { data: games } = await supabase.from('games').select('*');
      
      if (profiles) {
        const merged = profiles.map((p) => ({
          ...p,
          solvedCount: (prog || []).filter((r) => r.user_id === p.id && r.is_solved).length
        }));
        setStudents(merged);
      }
      if (games) setDbGames(games);
    }
    loadAdminData();
  }, []);

  const toggleGameStatus = async (gameId, currentStatus) => {
    if (!isSupabaseConfigured) return;
    const newStatus = !currentStatus;
    await supabase.from('games').update({ is_active: newStatus }).eq('id', gameId);
    setDbGames(dbGames.map(g => g.id === gameId ? { ...g, is_active: newStatus } : g));
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="flex items-center justify-between border-b border-stone-800 pb-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-amber-500" />
            <div>
              <h1 className="text-3xl font-extrabold">Admin Command Center</h1>
              <p className="text-stone-400 text-sm">Logged in as {profile?.nickname}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 bg-stone-800 hover:bg-stone-700 rounded-xl text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Student View
          </button>
        </div>

        {/* Flaw 2 Fix: Admin Module Toggles */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-orange-400">Module Access Control</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {GAMES_CONFIG.map((g) => {
              const dbRow = dbGames.find(db => db.id === g.id);
              const isLive = dbRow ? dbRow.is_active : g.fallbackIsActive;

              return (
                <div key={g.id} className="bg-stone-900 border border-stone-800 p-5 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm">{g.title}</p>
                    <p className={`text-xs ${isLive ? 'text-emerald-400' : 'text-stone-500'}`}>
                      {isLive ? 'Live for Students' : 'Locked (In Progress)'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleGameStatus(g.id, isLive)}
                      className={`p-2.5 rounded-xl text-white transition ${isLive ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-stone-700 hover:bg-stone-600'}`}
                      title={isLive ? "Lock Module" : "Unlock Module"}
                    >
                      {isLive ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => navigate(`/arena/${g.id}`)}
                      className="p-2.5 bg-orange-600 hover:bg-orange-500 rounded-xl text-white"
                      title="Test Module Override"
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-stone-800">
            <h2 className="text-xl font-bold">Student Progress</h2>
          </div>
          <table className="w-full text-left">
            <thead className="bg-stone-950 text-stone-400 text-xs uppercase font-mono">
              <tr>
                <th className="p-4">Nickname</th>
                <th className="p-4">Role</th>
                <th className="p-4">Problems Solved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="p-4 font-bold">{s.nickname}</td>
                  <td className="p-4 text-xs font-mono uppercase text-amber-400">{s.role}</td>
                  <td className="p-4 font-mono">{s.solvedCount} / {GAMES_CONFIG.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
