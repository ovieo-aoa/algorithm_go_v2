import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Code2, ArrowRight } from 'lucide-react';

const CODE_SNIPPETS = [
  "function minimax(board, depth, isMax) { ... }",
  "while (low <= high) { mid = (low + high) >> 1; }",
  "dp[i] = Math.min(dp[i], dp[i - coin] + 1);",
  "queue.push([startX, startY, 0]);",
  "if (board[a] === board[b] && board[b] === board[c]) return true;"
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 relative overflow-x-hidden font-sans">
      <nav className="relative z-20 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <Terminal className="w-6 h-6 text-orange-500" />
          <span>ALGORITHM GO</span>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl transition shadow-lg shadow-orange-600/20"
        >
          Login
        </button>
      </nav>

      <section className="relative min-h-[82vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden flex flex-col justify-around opacity-25 font-mono text-sm md:text-lg text-orange-400">
          {CODE_SNIPPETS.map((line, idx) => (
            <div
              key={idx}
              className="animate-code-bg whitespace-nowrap"
              style={{ animationDelay: `${idx * 1.1}s`, marginLeft: `${(idx % 3) * 12}%` }}
            >
              {line}
            </div>
          ))}
        </div>

        <div className="relative z-10 max-w-4xl space-y-6">
          <h1 className="text-6xl sm:text-8xl font-extrabold tracking-tight uppercase bg-gradient-to-br from-white via-stone-200 to-orange-400 bg-clip-text text-transparent">
            Algorithm Go
          </h1>
          <p className="text-stone-400 text-lg md:text-xl max-w-2xl mx-auto">
            Write deterministic code, battle automated test suites, and prove your algorithmic mastery.
          </p>
          <div className="pt-4">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-3 px-8 py-4 bg-orange-600 hover:bg-orange-500 text-white font-bold text-lg rounded-2xl transition transform hover:-translate-y-0.5"
            >
              Enter Arena <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      <section className="border-t border-stone-800 bg-stone-900/60 py-20 px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-4">
            <span className="text-orange-500 font-mono text-sm uppercase tracking-widest">Our Mission</span>
            <h2 className="text-4xl font-bold text-white">
              Stop memorizing syntax. Start engineering logic.
            </h2>
            <p className="text-stone-300 leading-relaxed text-lg">
              Algorithm Go bridges the gap between theoretical computer science and live execution. Instead of static multiple-choice quizzes, your code directly pilots bots inside interactive environments—tested against edge cases in real time.
            </p>
          </div>
          <div className="rounded-3xl overflow-hidden border border-stone-700 bg-stone-950 p-8 shadow-2xl">
            <div className="flex items-center gap-2 mb-4 text-stone-500 font-mono text-xs">
              <Code2 className="w-4 h-4 text-orange-500" />
              <span>sandbox_verifier.js</span>
            </div>
            <pre className="font-mono text-sm text-emerald-400 overflow-x-auto">
{`> Compiling bot logic...
> Running 100 adversarial matches...
> Match 01..50 [Player 1]: 50/50 Undefeated
> Match 51..100 [Player 2]: 50/50 Undefeated
> VERDICT: CORRECT`}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
