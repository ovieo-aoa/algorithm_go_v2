import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  RotateCcw,
  RefreshCw,
  TerminalSquare,
  Cpu,
  ChevronLeft,
  Bot,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function getWinResult(b) {
  for (const line of WIN_LINES) {
    const [a, c, d] = line;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) {
      return { winner: b[a], line };
    }
  }
  return null;
}

const WORKER_SCRIPT = `
  const WIN_LINES = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  function checkWinner(b) {
    for (const [a, c, d] of WIN_LINES) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    }
    return null;
  }

  function formatBoard(b) {
    const cell = (v, i) => (v ? ' ' + v + ' ' : '[' + i + ']');
    return [
      cell(b[0], 0) + '|' + cell(b[1], 1) + '|' + cell(b[2], 2),
      '---+---+---',
      cell(b[3], 3) + '|' + cell(b[4], 4) + '|' + cell(b[5], 5),
      '---+---+---',
      cell(b[6], 6) + '|' + cell(b[7], 7) + '|' + cell(b[8], 8)
    ].join('\\n');
  }

  function minimax(b, depth, isMax, botMark, oppMark) {
    const w = checkWinner(b);
    if (w === botMark) return 10 - depth;
    if (w === oppMark) return depth - 10;
    if (!b.includes(null)) return 0;

    if (isMax) {
      let best = -100;
      for (let i = 0; i < 9; i++) {
        if (b[i] === null) {
          b[i] = botMark;
          best = Math.max(best, minimax(b, depth + 1, false, botMark, oppMark));
          b[i] = null;
        }
      }
      return best;
    } else {
      let best = 100;
      for (let i = 0; i < 9; i++) {
        if (b[i] === null) {
          b[i] = oppMark;
          best = Math.min(best, minimax(b, depth + 1, true, botMark, oppMark));
          b[i] = null;
        }
      }
      return best;
    }
  }

  function bestMove(b, mark, oppMark) {
    let bestVal = -100;
    let move = -1;
    for (let i = 0; i < 9; i++) {
      if (b[i] === null) {
        b[i] = mark;
        const val = minimax(b, 0, false, mark, oppMark);
        b[i] = null;
        if (val > bestVal) {
          bestVal = val;
          move = i;
        }
      }
    }
    return move;
  }

  self.onmessage = function(e) {
    const { mode, code, board, botMark } = e.data;
    try {
      const userMakeMove = new Function(
        code + "\\n\\nif (typeof makeMove !== 'function') throw new Error('makeMove(board, player) is not defined'); return makeMove;"
      )();

      if (mode === 'single_move') {
        const move = userMakeMove([...board], botMark);
        self.postMessage({ mode: 'single_move', move });
        return;
      }

      const t0 = performance.now();
      const totalMatches = 60;

      for (let match = 0; match < totalMatches; match++) {
        const userIsX = match % 2 === 0;
        const userMark = userIsX ? 'X' : 'O';
        const testerMark = userIsX ? 'O' : 'X';
        const useOptimal = match < 20;
        const opponentLabel = useOptimal ? 'Optimal Minimax Bot' : 'Randomized Bot';
        let b = Array(9).fill(null);
        let turn = 'X';

        while (true) {
          let idx;
          if (turn === userMark) {
            idx = userMakeMove([...b], userMark);
          } else if (useOptimal) {
            idx = bestMove([...b], testerMark, userMark);
          } else {
            const avail = b.map((v, i) => (v === null ? i : null)).filter((v) => v !== null);
            idx = avail[Math.floor(Math.random() * avail.length)];
          }

          if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx > 8 || b[idx] !== null) {
            const reason = typeof idx !== 'number' || idx < 0 || idx > 8
              ? 'out-of-bounds value (' + idx + ')'
              : 'occupied square [' + idx + ']';
            self.postMessage({
              mode: 'verify',
              passed: false,
              message: 'Failed on Match #' + (match + 1) + '/' + totalMatches + ' (Playing as ' + userMark + ' vs. ' + opponentLabel + '): Illegal move — returned ' + reason + '.',
              boardSnapshot: formatBoard(b)
            });
            return;
          }

          b[idx] = turn;
          const winner = checkWinner(b);
          if (winner) {
            if (winner !== userMark) {
              self.postMessage({
                mode: 'verify',
                passed: false,
                message: 'Failed on Match #' + (match + 1) + '/' + totalMatches + ' (Playing as ' + userMark + ' vs. ' + opponentLabel + '): Bot was defeated.',
                boardSnapshot: formatBoard(b)
              });
              return;
            }
            break;
          }
          if (!b.includes(null)) break;
          turn = turn === 'X' ? 'O' : 'X';
        }
      }

      self.postMessage({
        mode: 'verify',
        passed: true,
        elapsed: performance.now() - t0,
        message: 'Passed all 60/60 matches (30 as X, 30 as O). Bot is undefeated!'
      });
    } catch (err) {
      self.postMessage({
        mode: 'error',
        passed: false,
        message: 'Runtime error: ' + err.message
      });
    }
  };
`;

const STARTER_CODE = `/*
 * TASK: Program a bot that ALWAYS wins or draws Tic-Tac-Toe,
 * whether starting first ('X') or second ('O').
 *
 * AVAILABLE DATA:
 *   board  -> Array of 9 items ('X', 'O', or null)
 *   player -> Your bot's symbol ('X' or 'O')
 *
 * RETURN: An integer index from 0 to 8 for your chosen square.
 */
function makeMove(board, player) {
  // Replace this basic fallback with Minimax or an optimal strategy:
  return board.findIndex(cell => cell === null);
}`;

const INITIAL_LOGS = [
  { type: 'info', text: 'Telepath ready. Write your bot and press RUN ALGORITHM.' }
];

export default function TicTacToeArena() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.id || 'guest';
  const storageKey = (field) => `algo_ttt_${uid}_${field}`;

  const [code, setCode] = useState(() => localStorage.getItem(storageKey('code')) || STARTER_CODE);
  const [board, setBoard] = useState(() => {
    const saved = localStorage.getItem(storageKey('board'));
    return saved ? JSON.parse(saved) : Array(9).fill(null);
  });
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem(storageKey('logs'));
    return saved ? JSON.parse(saved) : INITIAL_LOGS;
  });
  const [botStarts, setBotStarts] = useState(() => localStorage.getItem(storageKey('botstarts')) === 'true');
  const [statusText, setStatusText] = useState(
    () => localStorage.getItem(storageKey('status')) || 'Click RUN ALGORITHM to verify & start.'
  );
  const [gameOver, setGameOver] = useState(() => localStorage.getItem(storageKey('gameover')) === 'true');
  const [lastMove, setLastMove] = useState(() => {
    const saved = localStorage.getItem(storageKey('lastmove'));
    return saved !== null && saved !== '' ? Number(saved) : null;
  });
  const [winningLine, setWinningLine] = useState(() => {
    const saved = localStorage.getItem(storageKey('winline'));
    return saved ? JSON.parse(saved) : null;
  });

  const [botThinking, setBotThinking] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [confirmResetCode, setConfirmResetCode] = useState(false);
  const workerRef = useRef(null);

  useEffect(() => { localStorage.setItem(storageKey('code'), code); }, [code, uid]);
  useEffect(() => { localStorage.setItem(storageKey('board'), JSON.stringify(board)); }, [board, uid]);
  useEffect(() => { localStorage.setItem(storageKey('logs'), JSON.stringify(logs)); }, [logs, uid]);
  useEffect(() => { localStorage.setItem(storageKey('botstarts'), String(botStarts)); }, [botStarts, uid]);
  useEffect(() => { localStorage.setItem(storageKey('status'), statusText); }, [statusText, uid]);
  useEffect(() => { localStorage.setItem(storageKey('gameover'), String(gameOver)); }, [gameOver, uid]);
  useEffect(() => {
    localStorage.setItem(storageKey('lastmove'), lastMove !== null ? String(lastMove) : '');
  }, [lastMove, uid]);
  useEffect(() => {
    localStorage.setItem(storageKey('winline'), winningLine ? JSON.stringify(winningLine) : '');
  }, [winningLine, uid]);

  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    if (!confirmResetCode) return;
    const t = setTimeout(() => setConfirmResetCode(false), 3000);
    return () => clearTimeout(t);
  }, [confirmResetCode]);

  const addLog = (type, text, boardSnapshot = null) => {
    setLogs((prev) => [...prev, { type, text, boardSnapshot }]);
  };
  const clearLogs = () => setLogs([]);

  const spawnWorker = () => {
    workerRef.current?.terminate();
    const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const w = new Worker(url);
    URL.revokeObjectURL(url);
    workerRef.current = w;
    return w;
  };

  const triggerBotMove = (currentBoard, botMark) => {
    setBotThinking(true);
    const w = spawnWorker();
    const timer = setTimeout(() => {
      w.terminate();
      setBotThinking(false);
      addLog('error', 'Infinite loop timeout (>2000ms) during live match.');
      setStatusText('Bot timed out!');
      setGameOver(true);
    }, 2000);

    w.onmessage = (e) => {
      clearTimeout(timer);
      setBotThinking(false);

      if (e.data.mode === 'error') {
        addLog('error', e.data.message);
        setStatusText('Bot crashed!');
        setGameOver(true);
        return;
      }

      if (e.data.mode === 'single_move') {
        const idx = e.data.move;
        if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx > 8 || currentBoard[idx] !== null) {
          addLog('error', `Live match error: Bot returned illegal move (${idx}).`);
          setStatusText('Bot made an invalid move!');
          setGameOver(true);
          return;
        }
        const next = [...currentBoard];
        next[idx] = botMark;
        setBoard(next);
        setLastMove(idx);

        const result = getWinResult(next);
        if (result) {
          setWinningLine(result.line);
          setStatusText(`Bot (${result.winner}) wins!`);
          setGameOver(true);
        } else if (!next.includes(null)) {
          setStatusText('Match Draw!');
          setGameOver(true);
        } else {
          setStatusText(`Your turn (${botMark === 'X' ? 'O' : 'X'})`);
        }
      }
    };

    w.postMessage({ mode: 'single_move', code, board: currentBoard, botMark });
  };

  const startFreshMatch = (botFirstFlag) => {
    const fresh = Array(9).fill(null);
    setBoard(fresh);
    setGameOver(false);
    setLastMove(null);
    setWinningLine(null);

    if (botFirstFlag) {
      setStatusText('Bot thinking...');
      triggerBotMove(fresh, 'X');
    } else {
      setStatusText('Your turn (X)');
    }
  };

  const saveVerifiedProgress = async (elapsedMs) => {
    if (!isSupabaseConfigured || !user || user.id === 'demo-id') return;

    const { data: existing } = await supabase
      .from('user_progress')
      .select('best_execution_ms')
      .eq('user_id', user.id)
      .eq('game_id', 'tic-tac-toe')
      .maybeSingle();

    const fastest =
      existing?.best_execution_ms != null && elapsedMs != null
        ? Math.min(existing.best_execution_ms, elapsedMs)
        : elapsedMs ?? existing?.best_execution_ms ?? null;

    await supabase.from('user_progress').upsert(
      {
        user_id: user.id,
        game_id: 'tic-tac-toe',
        is_solved: true,
        best_execution_ms: fastest,
        last_submitted_code: code,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,game_id' }
    );
  };

  const handleRun = async () => {
    setVerifying(true);
    clearLogs();
    addLog('info', 'Running 60-match verification suite (30 as X, 30 as O)...');

    if (isSupabaseConfigured && user && user.id !== 'demo-id') {
      try {
        const { data, error } = await supabase.functions.invoke('verify-tictactoe', {
          body: { code }
        });

        if (!error && data && typeof data.passed === 'boolean') {
          addLog(data.passed ? 'success' : 'error', data.message, data.boardSnapshot || null);
          if (data.passed) await saveVerifiedProgress(data.elapsed ?? null);
          startFreshMatch(botStarts);
          setVerifying(false);
          return;
        }
      } catch {
        // Fall through silently to local Web Worker verification
      }
    }

    const w = spawnWorker();
    const timer = setTimeout(() => {
      w.terminate();
      addLog('error', 'Verification timed out (>2000ms). Check for infinite loops in your code.');
      setVerifying(false);
    }, 2000);

    w.onmessage = async (e) => {
      clearTimeout(timer);
      const { passed, message, elapsed, boardSnapshot } = e.data;
      const speedSuffix = passed && elapsed != null ? ` (${elapsed.toFixed(1)} ms)` : '';
      addLog(passed ? 'success' : 'error', `${message}${speedSuffix}`, boardSnapshot || null);

      if (passed) {
        await saveVerifiedProgress(elapsed);
      }

      startFreshMatch(botStarts);
      setVerifying(false);
    };

    w.postMessage({ mode: 'verify', code });
  };

  const handleCellClick = (idx) => {
    if (gameOver || botThinking || verifying || board[idx] !== null) return;
    const humanMark = botStarts ? 'O' : 'X';
    const botMark = botStarts ? 'X' : 'O';

    const next = [...board];
    next[idx] = humanMark;
    setBoard(next);
    setLastMove(idx);

    const result = getWinResult(next);
    if (result) {
      setWinningLine(result.line);
      setStatusText(`You (${result.winner}) win!`);
      setGameOver(true);
      return;
    }
    if (!next.includes(null)) {
      setStatusText('Match Draw!');
      setGameOver(true);
      return;
    }

    setStatusText('Bot thinking...');
    triggerBotMove(next, botMark);
  };

  const handleResetCode = () => {
    if (!confirmResetCode) {
      setConfirmResetCode(true);
      return;
    }
    setCode(STARTER_CODE);
    setConfirmResetCode(false);
    addLog('info', 'Editor restored to starter template.');
  };

  return (
    <div className="min-h-screen w-full bg-stone-950 text-stone-100 flex flex-col font-sans">
      <header className="h-16 bg-gradient-to-r from-orange-600 to-amber-600 flex items-center justify-between px-6 shadow-lg z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 bg-black/20 hover:bg-black/30 rounded-lg transition"
            title="Back to Dashboard"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight">
            Tic-Tac-Toe Engine
          </h1>
        </div>
        <button
          onClick={handleRun}
          disabled={verifying}
          className={`flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl font-bold transition shadow-xl ${
            verifying
              ? 'bg-stone-800 text-stone-400 cursor-wait'
              : 'bg-stone-950 hover:bg-stone-900 text-orange-400'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          {verifying ? 'VERIFYING...' : 'RUN ALGORITHM'}
        </button>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        <section className="lg:col-span-7 flex flex-col border-r border-stone-800">
          <div className="h-11 bg-stone-900 border-b border-stone-800 flex items-center justify-between px-4 text-stone-400 font-mono text-xs sm:text-sm z-10">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-orange-500" />
              <span>bot_logic.js</span>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleResetCode}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition ${
                  confirmResetCode
                    ? 'bg-rose-600 text-white font-bold'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                }`}
                title="Restore starter code"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {confirmResetCode ? 'Click to Confirm' : 'Reset Code'}
              </button>

              <div className="hidden sm:flex items-center gap-1.5 text-xs">
                {isSupabaseConfigured ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
                <span className={isSupabaseConfigured ? 'text-emerald-500' : 'text-amber-500'}>
                  {isSupabaseConfigured ? 'Cloud Sync' : 'Demo Mode'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[380px] relative bg-[#1e1e1e]">
            <Editor
              height="100%"
              defaultLanguage="javascript"
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 15,
                fontFamily: '"Fira Code", monospace',
                padding: { top: 16 },
                scrollBeyondLastLine: false,
                wordWrap: 'on'
              }}
            />
          </div>

          <div className="h-[260px] bg-black border-t-2 border-orange-500/40 flex flex-col z-10 shrink-0">
            <div className="h-10 bg-stone-900 border-b border-stone-800 flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <TerminalSquare className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-mono uppercase tracking-wider text-stone-300 font-bold">
                  Telepath Console
                </span>
              </div>
              <button
                onClick={clearLogs}
                className="text-xs font-mono text-stone-500 hover:text-stone-300 transition"
              >
                Clear
              </button>
            </div>
            <div className="p-4 font-mono text-sm space-y-3 overflow-y-auto flex-1">
              {logs.map((log, i) => (
                <div key={i} className="space-y-2">
                  <p
                    className={
                      log.type === 'success'
                        ? 'text-emerald-400 font-bold'
                        : log.type === 'error'
                        ? 'text-rose-400 font-bold'
                        : 'text-stone-400'
                    }
                  >
                    {log.text}
                  </p>
                  {log.boardSnapshot && (
                    <pre className="inline-block bg-stone-900/90 border border-rose-500/40 rounded-lg px-4 py-2.5 text-xs text-stone-200 leading-relaxed">
                      {log.boardSnapshot}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 bg-stone-950 flex flex-col items-center justify-center p-8 space-y-7 overflow-y-auto">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-extrabold uppercase tracking-tight">Live Match Arena</h2>
            <p className="text-orange-400 font-semibold text-lg">{statusText}</p>
          </div>

          <div className="bg-stone-900 border border-stone-700 p-1.5 rounded-xl flex gap-2">
            <button
              onClick={() => {
                setBotStarts(false);
                startFreshMatch(false);
              }}
              className={`px-5 py-2.5 rounded-lg font-bold text-sm transition ${
                !botStarts ? 'bg-orange-600 text-white' : 'text-stone-400 hover:text-white'
              }`}
            >
              You Start (X)
            </button>
            <button
              onClick={() => {
                setBotStarts(true);
                startFreshMatch(true);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition ${
                botStarts ? 'bg-orange-600 text-white' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Bot className="w-4 h-4" /> Bot Starts (X)
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 p-4 bg-gradient-to-br from-orange-600 to-amber-700 rounded-3xl shadow-2xl">
            {board.map((cell, idx) => {
              const isWinCell = winningLine?.includes(idx);
              const isLastCell = lastMove === idx && !winningLine;

              return (
                <button
                  key={idx}
                  onClick={() => handleCellClick(idx)}
                  disabled={gameOver || botThinking || cell !== null}
                  className={`relative w-20 h-20 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-2xl flex items-center justify-center text-5xl sm:text-7xl font-extrabold transition border-2 ${
                    isWinCell
                      ? 'bg-emerald-950 border-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.4)]'
                      : isLastCell
                      ? 'bg-stone-900 border-amber-400/80'
                      : 'bg-stone-950 hover:bg-stone-900 border-transparent hover:border-orange-500/30'
                  } ${cell === 'X' ? 'text-orange-500' : 'text-sky-400'}`}
                >
                  {cell}
                  {isLastCell && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400" />
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => startFreshMatch(botStarts)}
            className="flex items-center gap-2 text-stone-400 hover:text-white font-semibold transition"
          >
            <RotateCcw className="w-4 h-4" /> Reset Board
          </button>
        </section>
      </main>
    </div>
  );
}
