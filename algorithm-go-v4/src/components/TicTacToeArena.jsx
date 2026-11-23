import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Play, RotateCcw, TerminalSquare, Cpu, ChevronLeft, Bot, ShieldCheck, AlertTriangle } from 'lucide-react';
import Editor from '@monaco-editor/react'; // FLAW 1 FIX: Replaced textarea with Monaco
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Kept Worker for instant UI response and single-move simulations
const WORKER_SCRIPT = `
  function checkWinner(b) {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a, c, d] of lines) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    }
    return null;
  }
  function minimax(b, depth, isMax, botMark, oppMark) {
    const w = checkWinner(b);
    if (w === botMark) return 10 - depth;
    if (w === oppMark) return depth - 10;
    if (!b.includes(null)) return 0;

    if (isMax) {
      let best = -100;
      for (let i = 0; i < 9; i++) {
        if (b[i] === null) { b[i] = botMark; best = Math.max(best, minimax(b, depth + 1, false, botMark, oppMark)); b[i] = null; }
      }
      return best;
    } else {
      let best = 100;
      for (let i = 0; i < 9; i++) {
        if (b[i] === null) { b[i] = oppMark; best = Math.min(best, minimax(b, depth + 1, true, botMark, oppMark)); b[i] = null; }
      }
      return best;
    }
  }
  function bestMove(b, mark, oppMark) {
    let bestVal = -100; let move = -1;
    for (let i = 0; i < 9; i++) {
      if (b[i] === null) {
        b[i] = mark; const val = minimax(b, 0, false, mark, oppMark); b[i] = null;
        if (val > bestVal) { bestVal = val; move = i; }
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
      
      // Local fallback verification if Edge Function fails
      const t0 = performance.now();
      for (let match = 0; match < 60; match++) {
        const userIsX = match % 2 === 0;
        const userMark = userIsX ? 'X' : 'O';
        const testerMark = userIsX ? 'O' : 'X';
        const useOptimal = match < 20;
        let b = Array(9).fill(null);
        let turn = 'X';

        while (true) {
          let idx;
          if (turn === userMark) {
            idx = userMakeMove([...b], userMark);
          } else if (useOptimal) {
            idx = bestMove([...b], testerMark, userMark);
          } else {
            const avail = b.map((v, i) => v === null ? i : null).filter(v => v !== null);
            idx = avail[Math.floor(Math.random() * avail.length)];
          }

          if (typeof idx !== 'number' || idx < 0 || idx > 8 || b[idx] !== null) {
            self.postMessage({ mode: 'verify', passed: false, message: 'No. Illegal move returned: ' + idx }); return;
          }
          b[idx] = turn;
          const winner = checkWinner(b);
          if (winner) {
            if (winner !== userMark) { self.postMessage({ mode: 'verify', passed: false, message: 'No. Bot was defeated.' }); return; }
            break;
          }
          if (!b.includes(null)) break;
          turn = turn === 'X' ? 'O' : 'X';
        }
      }
      self.postMessage({ mode: 'verify', passed: true, elapsed: performance.now() - t0, message: 'Correct! Bot is undefeated.' });
    } catch (err) {
      self.postMessage({ mode: 'error', message: 'No. Runtime error: ' + err.message });
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
  // Replace this basic fallback with Minimax or optimal strategy:
  return board.findIndex(cell => cell === null);
}`;

export default function TicTacToeArena() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // FLAW 3 FIX: State preservation on refresh via localStorage
  const [code, setCode] = useState(() => localStorage.getItem('algo_ttt_code') || STARTER_CODE);
  const [board, setBoard] = useState(() => {
    const saved = localStorage.getItem('algo_ttt_board');
    return saved ? JSON.parse(saved) : Array(9).fill(null);
  });
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('algo_ttt_logs');
    return saved ? JSON.parse(saved) : [{ type: 'info', text: 'Telepath ready. Write your bot and press RUN.' }];
  });
  const [botStarts, setBotStarts] = useState(() => localStorage.getItem('algo_ttt_botstarts') === 'true');
  const [statusText, setStatusText] = useState(() => localStorage.getItem('algo_ttt_status') || 'Click RUN ALGORITHM to start & verify.');
  
  const [gameOver, setGameOver] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const workerRef = useRef(null);

  // Sync to localstorage
  useEffect(() => { localStorage.setItem('algo_ttt_code', code); }, [code]);
  useEffect(() => { localStorage.setItem('algo_ttt_board', JSON.stringify(board)); }, [board]);
  useEffect(() => { localStorage.setItem('algo_ttt_logs', JSON.stringify(logs)); }, [logs]);
  useEffect(() => { localStorage.setItem('algo_ttt_botstarts', botStarts); }, [botStarts]);
  useEffect(() => { localStorage.setItem('algo_ttt_status', statusText); }, [statusText]);

  useEffect(() => { return () => workerRef.current?.terminate(); }, []);

  const addLog = (type, text) => setLogs(prev => [...prev, { type, text }]);
  const clearLogs = () => setLogs([]);

  const checkWinner = (b) => {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a, c, d] of lines) { if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]; }
    return null;
  };

  const spawnWorker = () => {
    workerRef.current?.terminate();
    const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
    const w = new Worker(URL.createObjectURL(blob));
    workerRef.current = w;
    return w;
  };

  const triggerBotMove = (currentBoard, botMark) => {
    const w = spawnWorker();
    const timer = setTimeout(() => {
      w.terminate();
      addLog('error', 'No. Infinite loop timeout (>2000ms).');
      setGameOver(true);
    }, 2000);

    w.onmessage = (e) => {
      clearTimeout(timer);
      if (e.data.mode === 'single_move') {
        const idx = e.data.move;
        if (typeof idx !== 'number' || idx < 0 || idx > 8 || currentBoard[idx] !== null) {
          setStatusText('Bot made an invalid move!');
          setGameOver(true);
          return;
        }
        const next = [...currentBoard];
        next[idx] = botMark;
        setBoard(next);
        const win = checkWinner(next);
        if (win) {
          setStatusText(`Bot (${win}) wins!`);
          setGameOver(true);
        } else if (!next.includes(null)) {
          setStatusText('Match Draw!');
          setGameOver(true);
        } else {
          setStatusText('Your turn');
        }
      }
    };
    w.postMessage({ mode: 'single_move', code, board: currentBoard, botMark });
  };

  const startFreshMatch = (botFirstFlag) => {
    const fresh = Array(9).fill(null);
    setBoard(fresh);
    setGameOver(false);
    if (botFirstFlag) {
      setStatusText('Bot thinking...');
      triggerBotMove(fresh, 'X');
    } else {
      setStatusText('Your turn (X)');
    }
  };

  const handleRun = async () => {
    setVerifying(true);
    clearLogs();
    addLog('info', 'Executing algorithm...');

    // FLAW 4 FIX: Attempt Secure Server Verification first
    if (isSupabaseConfigured && user && user.id !== 'demo-id') {
      addLog('info', 'Attempting Secure Edge Verification...');
      try {
        const { data, error } = await supabase.functions.invoke('verify-tictactoe', {
          body: { code }
        });
        
        if (!error && data) {
          addLog(data.passed ? 'success' : 'error', `[SERVER VERIFIED] ${data.message}`);
          startFreshMatch(botStarts);
          setVerifying(false);
          return; // Server handled it securely!
        } else {
          addLog('info', 'Edge Function not deployed. Falling back to local worker...');
        }
      } catch (err) {
        addLog('info', 'Edge Function not deployed. Falling back to local worker...');
      }
    } else {
      addLog('info', 'Demo Mode: Running insecure local verification...');
    }

    // Fallback: Local Web Worker Verification
    const w = spawnWorker();
    const timer = setTimeout(() => {
      w.terminate();
      addLog('error', 'No. Infinite loop detected (Timed out).');
      setVerifying(false);
    }, 2000);

    w.onmessage = async (e) => {
      clearTimeout(timer);
      const { passed, message, elapsed } = e.data;
      addLog(passed ? 'success' : 'error', `[LOCAL VERIFIED] ${message}`);
      startFreshMatch(botStarts);
      
      // Even if local, we save it (Though insecure as noted in critique)
      if (passed && isSupabaseConfigured && user && user.id !== 'demo-id') {
        await supabase.from('user_progress').upsert({
          user_id: user.id, game_id: 'tic-tac-toe', is_solved: true,
          best_execution_ms: elapsed, last_submitted_code: code
        }, { onConflict: 'user_id,game_id' });
      }
      setVerifying(false);
    };
    w.postMessage({ mode: 'verify', code });
  };

  const handleCellClick = (idx) => {
    if (gameOver || board[idx] !== null) return;
    const humanMark = botStarts ? 'O' : 'X';
    const botMark = botStarts ? 'X' : 'O';

    const next = [...board];
    next[idx] = humanMark;
    setBoard(next);

    const win = checkWinner(next);
    if (win) { setStatusText(`You (${win}) win!`); setGameOver(true); return; }
    if (!next.includes(null)) { setStatusText('Match Draw!'); setGameOver(true); return; }

    setStatusText('Bot thinking...');
    triggerBotMove(next, botMark);
  };

  return (
    <div className="min-h-screen w-full bg-stone-950 text-stone-100 flex flex-col font-sans">
      <header className="h-16 bg-gradient-to-r from-orange-600 to-amber-600 flex items-center justify-between px-6 shadow-lg z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 bg-black/20 hover:bg-black/30 rounded-lg">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight">Tic-Tac-Toe Engine</h1>
        </div>
        <button
          onClick={handleRun}
          disabled={verifying}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition shadow-xl ${verifying ? 'bg-stone-700 text-stone-400' : 'bg-stone-950 hover:bg-stone-900 text-orange-400'}`}
        >
          <Play className="w-4 h-4 fill-current" />
          {verifying ? 'VERIFYING...' : 'RUN ALGORITHM'}
        </button>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        <section className="lg:col-span-7 flex flex-col border-r border-stone-800">
          <div className="h-11 bg-stone-900 border-b border-stone-800 flex items-center justify-between px-4 text-stone-400 font-mono text-sm z-10">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-orange-500" />
              <span>bot_logic.js</span>
            </div>
            {/* Security Indicator */}
            <div className="flex items-center gap-1.5 text-xs">
              {isSupabaseConfigured ? <ShieldCheck className="w-4 h-4 text-emerald-500"/> : <AlertTriangle className="w-4 h-4 text-amber-500"/>}
              <span className={isSupabaseConfigured ? 'text-emerald-500' : 'text-amber-500'}>
                {isSupabaseConfigured ? 'Cloud Sync Active' : 'Local Demo Mode'}
              </span>
            </div>
          </div>

          {/* FLAW 1 FIX: Monaco Editor */}
          <div className="flex-1 min-h-[400px] relative bg-[#1e1e1e]">
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
                <span className="text-xs font-mono uppercase tracking-wider text-stone-300 font-bold">Telepath Console</span>
              </div>
              <button onClick={clearLogs} className="text-xs font-mono text-stone-500 hover:text-stone-300">Clear</button>
            </div>
            <div className="p-4 font-mono space-y-2 overflow-y-auto flex-1">
              {logs.map((log, i) => (
                <p key={i} className={`
                  ${log.type === 'success' ? 'text-emerald-400 font-bold' : ''}
                  ${log.type === 'error' ? 'text-rose-500 font-bold' : ''}
                  ${log.type === 'info' ? 'text-stone-400' : ''}
                `}>
                  {log.text}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 bg-stone-950 flex flex-col items-center justify-center p-8 space-y-8 overflow-y-auto">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-extrabold uppercase">Live Match Arena</h2>
            <p className="text-orange-400 font-semibold text-lg">{statusText}</p>
          </div>

          <div className="bg-stone-900 border border-stone-700 p-1.5 rounded-xl flex gap-2">
            <button
              onClick={() => { setBotStarts(false); startFreshMatch(false); }}
              className={`px-5 py-3 rounded-lg font-bold text-sm transition ${!botStarts ? 'bg-orange-600 text-white' : 'text-stone-400 hover:text-white'}`}
            >
              You Start (X)
            </button>
            <button
              onClick={() => { setBotStarts(true); startFreshMatch(true); }}
              className={`flex items-center gap-2 px-5 py-3 rounded-lg font-bold text-sm transition ${botStarts ? 'bg-orange-600 text-white' : 'text-stone-400 hover:text-white'}`}
            >
              <Bot className="w-4 h-4" /> Bot Starts (X)
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 p-4 bg-gradient-to-br from-orange-600 to-amber-700 rounded-3xl shadow-2xl">
            {board.map((cell, idx) => (
              <button
                key={idx}
                onClick={() => handleCellClick(idx)}
                className="w-20 h-20 sm:w-28 sm:h-28 lg:w-32 lg:h-32 bg-stone-950 hover:bg-stone-900 rounded-2xl flex items-center justify-center text-5xl sm:text-7xl font-extrabold text-orange-500 transition border-2 border-transparent hover:border-orange-500/30"
              >
                {cell}
              </button>
            ))}
          </div>

          <button onClick={() => startFreshMatch(botStarts)} className="flex items-center gap-2 text-stone-400 hover:text-white font-semibold mt-4">
            <RotateCcw className="w-4 h-4" /> Reset Board
          </button>
        </section>
      </main>
    </div>
  );
}
