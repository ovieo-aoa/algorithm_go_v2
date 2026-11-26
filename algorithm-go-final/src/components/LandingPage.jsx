import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Terminal,
  Play,
  Cpu,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Code2,
  Trophy
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CODE_SNIPPETS = [
  {
    filename: 'tic_tac_toe_bot.py',
    badge: '16/16 Verified',
    code: `# Algorithm Go — Undefeated Tic-Tac-Toe Strategy
# Boxes are numbered 1 to 9

if winning_box(me) is not None:
    play(winning_box(me))

if winning_box(opponent) is not None:
    play(winning_box(opponent))

if my_turn == 1:
    play_any([5, 1, 3, 7, 9])

if fork_box(me) is not None:
    play(fork_box(me))

if fork_box(opponent) is not None:
    play(fork_box(opponent))

play_any([5, 1, 3, 7, 9, 2, 4, 6, 8])`
  },
  {
    filename: 'maze_pathfinder.py',
    badge: 'Optimal Path',
    code: `# Algorithm Go — Autonomous Maze Navigator
# Left-hand wall follower with dead-end memory

if at_goal():
    celebrate()

if not wall_left():
    turn_left()
    move_forward()
elif not wall_ahead():
    move_forward()
elif not wall_right():
    turn_right()
    move_forward()
else:
    turn_around()`
  },
  {
    filename: 'binary_search.py',
    badge: 'O(log n) Speed',
    code: `def guess_number(low, high):
    attempts = 0

    while low <= high:
        mid = (low + high) // 2
        attempts += 1
        result = check_guess(mid)

        if result == "CORRECT":
            return mid
        elif result == "HIGHER":
            low = mid + 1
        else:
            high = mid - 1`
  }
];

const KEYWORDS = new Set([
  'if', 'elif', 'else', 'def', 'return', 'while', 'for', 'in',
  'is', 'not', 'and', 'or', 'True', 'False', 'None'
]);

const BUILTINS = new Set([
  'play', 'play_any', 'play_random', 'winning_box', 'fork_box',
  'is_empty', 'has_piece', 'move_forward', 'turn_left', 'turn_right',
  'turn_around', 'wall_left', 'wall_ahead', 'wall_right', 'at_goal',
  'check_guess', 'celebrate'
]);

function highlightPythonLine(line) {
  const commentIdx = line.indexOf('#');
  const codePart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
  const commentPart = commentIdx >= 0 ? line.slice(commentIdx) : '';

  const tokens = codePart.split(/(\b[A-Za-z_]\w*\b|\b\d+\b|"[^"]*"|'[^']*')/g);

  return (
    <>
      {tokens.map((tok, i) => {
        if (!tok) return null;
        if (KEYWORDS.has(tok)) {
          return (
            <span key={i} className="text-orange-400 font-semibold">
              {tok}
            </span>
          );
        }
        if (BUILTINS.has(tok)) {
          return (
            <span key={i} className="text-amber-300">
              {tok}
            </span>
          );
        }
        if (/^\d+$/.test(tok)) {
          return (
            <span key={i} className="text-sky-400">
              {tok}
            </span>
          );
        }
        if (/^["'].*["']$/.test(tok)) {
          return (
            <span key={i} className="text-emerald-400">
              {tok}
            </span>
          );
        }
        return (
          <span key={i} className="text-stone-300">
            {tok}
          </span>
        );
      })}
      {commentPart && <span className="text-stone-500 italic">{commentPart}</span>}
    </>
  );
}

function BackgroundCodeEditor() {
  const [snippetIndex, setSnippetIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [phase, setPhase] = useState('typing'); // 'typing' | 'pause' | 'clearing'

  const current = CODE_SNIPPETS[snippetIndex];

  useEffect(() => {
    let timeout;

    if (phase === 'typing') {
      if (charCount < current.code.length) {
        const nextChar = current.code[charCount];
        const delay = nextChar === '\n' ? 95 : nextChar === ' ' ? 16 : 26 + Math.random() * 24;
        timeout = setTimeout(() => setCharCount((c) => c + 1), delay);
      } else {
        timeout = setTimeout(() => setPhase('pause'), 2400);
      }
    } else if (phase === 'pause') {
      timeout = setTimeout(() => setPhase('clearing'), 400);
    } else if (phase === 'clearing') {
      if (charCount > 0) {
        timeout = setTimeout(() => setCharCount((c) => Math.max(0, c - 14)), 14);
      } else {
        setSnippetIndex((idx) => (idx + 1) % CODE_SNIPPETS.length);
        setPhase('typing');
      }
    }

    return () => clearTimeout(timeout);
  }, [charCount, phase, current.code]);

  const visibleLines = useMemo(() => {
    return current.code.slice(0, charCount).split('\n');
  }, [current.code, charCount]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden select-none z-0 flex items-center justify-center p-4 sm:p-10"
    >
      {/* Subtle Ambient Orange Glow */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[780px] h-[420px] bg-orange-600/15 blur-[140px] rounded-full" />
      <div className="absolute bottom-0 right-10 w-[520px] h-[360px] bg-amber-500/10 blur-[130px] rounded-full" />

      {/* Background Code Editor Window */}
      <div className="w-full max-w-5xl h-[78vh] max-h-[720px] rounded-3xl border border-stone-800/80 bg-stone-900/55 shadow-2xl overflow-hidden flex flex-col opacity-45 sm:opacity-50 backdrop-blur-[1px]">
        {/* Editor Title Bar */}
        <div className="h-11 bg-stone-950/90 border-b border-stone-800/80 px-4 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/70" />
            <span className="w-3 h-3 rounded-full bg-amber-500/70" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
            <span className="ml-3 text-stone-300 font-semibold flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-orange-500" />
              {current.filename}
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-600/40 text-emerald-400 text-[11px]">
            {current.badge}
          </span>
        </div>

        {/* Editor Code Area */}
        <div className="flex-1 p-5 sm:p-8 font-mono text-xs sm:text-sm md:text-[15px] leading-relaxed overflow-hidden">
          {visibleLines.map((line, idx) => {
            const isLastLine = idx === visibleLines.length - 1;
            return (
              <div key={idx} className="flex items-start">
                <span className="w-8 sm:w-10 shrink-0 text-right pr-4 text-stone-600">
                  {idx + 1}
                </span>
                <pre className="whitespace-pre-wrap break-words flex-1">
                  {highlightPythonLine(line)}
                  {isLastLine && (
                    <span className="inline-block w-2 h-4 sm:h-5 ml-0.5 align-middle bg-orange-400 animate-pulse" />
                  )}
                </pre>
              </div>
            );
          })}
        </div>
      </div>

      {/* Radial Vignette so Hero Text stays razor-sharp */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(12,10,9,0.52)_0%,rgba(12,10,9,0.88)_68%,rgba(12,10,9,0.97)_100%)]" />
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen w-full bg-stone-950 text-stone-100 flex flex-col justify-between overflow-x-hidden font-sans">
      {/* Live Typing Code Editor Backdrop */}
      <BackgroundCodeEditor />

      {/* Top Navigation */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-600 to-amber-600 shadow-lg shadow-orange-600/20">
            <Terminal className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-extrabold uppercase tracking-tight">Algorithm Go</span>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition shadow-lg"
            >
              Go to Dashboard
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-sm font-bold text-stone-300 hover:text-white transition"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition shadow-lg shadow-orange-600/25"
              >
                Start Coding
              </button>
            </>
          )}
        </div>
      </header>

      {/* Center Hero Section */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-stone-900/90 border border-orange-500/30 text-orange-400 text-xs font-mono uppercase tracking-wider shadow">
          <Sparkles className="w-3.5 h-3.5" />
          Interactive Python Game Arenas
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08]">
          Write Real Python.{' '}
          <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">
            Outsmart the Arena.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-xl text-stone-300 leading-relaxed">
          Learn logic, conditionals, and search algorithms by programming autonomous bots in real
          Python—tested live in your browser against undefeated opponents.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            onClick={() => navigate(user ? '/dashboard' : '/login')}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-extrabold text-base shadow-xl shadow-orange-600/25 flex items-center justify-center gap-2.5 transition"
          >
            <Play className="w-5 h-5 fill-current" />
            {user ? 'Enter Arenas' : 'Launch First Arena'}
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            onClick={() => navigate('/arena/tic-tac-toe')}
            className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-stone-900/90 hover:bg-stone-800 border border-stone-700 text-stone-200 font-bold text-base flex items-center justify-center gap-2 transition"
          >
            <Code2 className="w-5 h-5 text-orange-400" />
            Try Tic-Tac-Toe Live
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-10 text-left">
          <div className="p-5 rounded-2xl bg-stone-900/80 border border-stone-800/90 backdrop-blur-md space-y-2">
            <Cpu className="w-5 h-5 text-orange-400" />
            <h3 className="font-bold text-stone-100">In-Browser Python 3</h3>
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
              Zero setup required. Your Python code runs securely in an isolated browser sandbox.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-stone-900/80 border border-stone-800/90 backdrop-blur-md space-y-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-stone-100">Automated Verification</h3>
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
              Every bot faces a 16-match test suite with visual board diagnostics on every edge case.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-stone-900/80 border border-stone-800/90 backdrop-blur-md space-y-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-stone-100">Built for Classroom Flow</h3>
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
              Progress from intuitive game rules to optimal search and recursion at your own pace.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 text-center text-xs text-stone-500">
        Algorithm Go • Interactive Programming Logic Platform
      </footer>
    </div>
  );
}
