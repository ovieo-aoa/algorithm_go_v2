import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  AlertTriangle,
  Loader2
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

const PYTHON_HELPERS = `
WIN_LINES = [
    (0, 1, 2), (3, 4, 5), (6, 7, 8),
    (0, 3, 6), (1, 4, 7), (2, 5, 8),
    (0, 4, 8), (2, 4, 6)
]

def get_available_moves(board):
    """Returns a list of indices (0-8) that are currently empty."""
    return [i for i, cell in enumerate(board) if cell is None]

def check_winner(board):
    """Returns 'X', 'O', or None if there is no winner yet."""
    for a, b, c in WIN_LINES:
        if board[a] is not None and board[a] == board[b] == board[c]:
            return board[a]
    return None

def is_board_full(board):
    """Returns True if no empty squares remain."""
    return None not in board

def get_opponent(player):
    """Returns 'O' if player is 'X', or 'X' if player is 'O'."""
    return 'O' if player == 'X' else 'X'

def simulate_move(board, index, player):
    """Returns a NEW copy of the board with player placed at index."""
    new_board = list(board)
    new_board[index] = player
    return new_board
`;

const WORKER_SCRIPT = `
  importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js");

  let pyodideReadyPromise = null;
  let taskQueue = Promise.resolve();

  function ensurePyodide() {
    if (!pyodideReadyPromise) {
      pyodideReadyPromise = loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/"
      });
    }
    return pyodideReadyPromise;
  }

  async function processMessage(e) {
    const { mode, code, helpers, board, botMark } = e.data;

    try {
      const py = await ensurePyodide();

      if (mode === 'init') {
        self.postMessage({ mode: 'ready' });
        return;
      }

      py.globals.set("js_helpers", helpers);
      py.globals.set("js_user_code", code);
      py.globals.set("js_mode", mode);
      py.globals.set("js_board", board || []);
      py.globals.set("js_bot_mark", botMark || "X");

      const rawResult = await py.runPythonAsync(\`
import io
import sys
import json
import time
import random

def _format_board(b):
    def cell(v, i):
        return f" {v} " if v is not None else f"[{i}]"
    rows = [
        f"{cell(b[0], 0)}|{cell(b[1], 1)}|{cell(b[2], 2)}",
        "---+---+---",
        f"{cell(b[3], 3)}|{cell(b[4], 4)}|{cell(b[5], 5)}",
        "---+---+---",
        f"{cell(b[6], 6)}|{cell(b[7], 7)}|{cell(b[8], 8)}"
    ]
    return "\\\\n".join(rows)

_MEMO = {}
_TEST_LINES = [
    (0, 1, 2), (3, 4, 5), (6, 7, 8),
    (0, 3, 6), (1, 4, 7), (2, 5, 8),
    (0, 4, 8), (2, 4, 6)
]

def _test_winner(b):
    for a, c, d in _TEST_LINES:
        if b[a] is not None and b[a] == b[c] == b[d]:
            return b[a]
    return None

def _minimax_score(state, is_max, bot_mark, opp_mark):
    key = (state, is_max, bot_mark)
    if key in _MEMO:
        return _MEMO[key]
    w = _test_winner(state)
    if w == bot_mark:
        return 10
    if w == opp_mark:
        return -10
    if None not in state:
        return 0

    if is_max:
        best = -100
        for i in range(9):
            if state[i] is None:
                nxt = state[:i] + (bot_mark,) + state[i+1:]
                val = _minimax_score(nxt, False, bot_mark, opp_mark) - 1
                if val > best:
                    best = val
    else:
        best = 100
        for i in range(9):
            if state[i] is None:
                nxt = state[:i] + (opp_mark,) + state[i+1:]
                val = _minimax_score(nxt, True, bot_mark, opp_mark) + 1
                if val < best:
                    best = val
    _MEMO[key] = best
    return best

def _optimal_move(b, mark, opp_mark):
    state = tuple(b)
    best_val = -100
    chosen = -1
    for i in range(9):
        if state[i] is None:
            nxt = state[:i] + (mark,) + state[i+1:]
            val = _minimax_score(nxt, False, mark, opp_mark)
            if val > best_val:
                best_val = val
                chosen = i
    return chosen

def _run():
    env = {}
    try:
        exec(js_helpers, env)
        exec(js_user_code, env)
    except Exception as exc:
        return json.dumps({
            "mode": "error",
            "passed": False,
            "message": f"Syntax/Load error: {type(exc).__name__}: {exc}"
        })

    make_move = env.get("make_move")
    if not callable(make_move):
        return json.dumps({
            "mode": "error",
            "passed": False,
            "message": "Function make_move(board, player) is not defined."
        })

    if js_mode == "single_move":
        b = list(js_board.to_py())
        old_stdout = sys.stdout
        sys.stdout = buf = io.StringIO()
        try:
            move = make_move(list(b), js_bot_mark)
        except Exception as exc:
            sys.stdout = old_stdout
            return json.dumps({
                "mode": "error",
                "passed": False,
                "message": f"Runtime error: {type(exc).__name__}: {exc}",
                "stdout": buf.getvalue()
            })
        finally:
            sys.stdout = old_stdout

        return json.dumps({
            "mode": "single_move",
            "move": move if isinstance(move, int) and not isinstance(move, bool) else str(move),
            "is_valid_int": isinstance(move, int) and not isinstance(move, bool),
            "stdout": buf.getvalue()
        })

    # Verification suite: 16 matches (8 as X, 8 as O) — 8 vs Optimal Minimax, 8 vs Randomized
    t0 = time.perf_counter()
    total_matches = 16
    devnull = io.StringIO()

    for match in range(total_matches):
        user_is_x = (match % 2 == 0)
        user_mark = "X" if user_is_x else "O"
        tester_mark = "O" if user_is_x else "X"
        use_optimal = match < 8
        opponent_label = "Optimal Minimax Bot" if use_optimal else "Randomized Bot"
        b = [None] * 9
        turn = "X"

        while True:
            if turn == user_mark:
                old_stdout = sys.stdout
                sys.stdout = devnull
                try:
                    idx = make_move(list(b), user_mark)
                except Exception as exc:
                    sys.stdout = old_stdout
                    return json.dumps({
                        "mode": "verify",
                        "passed": False,
                        "message": f"Crash on Match #{match + 1}/{total_matches} (Playing as {user_mark}): {type(exc).__name__}: {exc}",
                        "boardSnapshot": _format_board(b)
                    })
                finally:
                    sys.stdout = old_stdout
            elif use_optimal:
                idx = _optimal_move(b, tester_mark, user_mark)
            else:
                avail = [i for i, v in enumerate(b) if v is None]
                idx = random.choice(avail)

            if not isinstance(idx, int) or isinstance(idx, bool) or idx < 0 or idx > 8 or b[idx] is not None:
                reason = (
                    f"invalid value ({idx!r})"
                    if not isinstance(idx, int) or isinstance(idx, bool) or idx < 0 or idx > 8
                    else f"occupied square [{idx}]"
                )
                return json.dumps({
                    "mode": "verify",
                    "passed": False,
                    "message": f"Failed on Match #{match + 1}/{total_matches} (Playing as {user_mark} vs. {opponent_label}): Illegal move — returned {reason}.",
                    "boardSnapshot": _format_board(b)
                })

            b[idx] = turn
            winner = _test_winner(b)
            if winner is not None:
                if winner != user_mark:
                    return json.dumps({
                        "mode": "verify",
                        "passed": False,
                        "message": f"Failed on Match #{match + 1}/{total_matches} (Playing as {user_mark} vs. {opponent_label}): Bot was defeated.",
                        "boardSnapshot": _format_board(b)
                    })
                break
            if None not in b:
                break
            turn = "O" if turn == "X" else "X"

    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    return json.dumps({
        "mode": "verify",
        "passed": True,
        "elapsed": elapsed_ms,
        "message": f"Passed all {total_matches}/{total_matches} matches (8 as X, 8 as O). Bot is undefeated!"
    })

_run()
      \`);

      self.postMessage(JSON.parse(rawResult));
    } catch (err) {
      self.postMessage({
        mode: 'error',
        passed: false,
        message: 'Python Engine Error: ' + err.message
      });
    }
  }

  self.onmessage = function(e) {
    taskQueue = taskQueue.then(() => processMessage(e)).catch(() => {});
  };
`;

const STARTER_CODE = `# TASK: Write a Python bot that ALWAYS wins or draws Tic-Tac-Toe,
# whether starting first ('X') or second ('O').
#
# AVAILABLE PREDEFINED FUNCTIONS:
#   get_available_moves(board)        -> List of empty indices, e.g. [0, 4, 8]
#   check_winner(board)               -> Returns 'X', 'O', or None
#   is_board_full(board)              -> Returns True or False
#   get_opponent(player)              -> Returns 'O' for 'X', or 'X' for 'O'
#   simulate_move(board, idx, player) -> Returns a new board copy with move applied
#
# PARAMETERS:
#   board  -> List of 9 items ('X', 'O', or None)
#   player -> Your bot's symbol ('X' or 'O')
#
# RETURN: An integer from 0 to 8 for your chosen square.

def make_move(board, player):
    opponent = get_opponent(player)
    moves = get_available_moves(board)

    # 1. Check if we can win immediately on this move:
    for move in moves:
        test_board = simulate_move(board, move, player)
        if check_winner(test_board) == player:
            return move

    # 2. Check if we need to block the opponent from winning:
    for move in moves:
        test_board = simulate_move(board, move, opponent)
        if check_winner(test_board) == opponent:
            return move

    # 3. Replace the fallback below with full Minimax or fork strategy:
    return moves[0]
`;

const INITIAL_LOGS = [
  { type: 'info', text: 'Telepath ready. Write your Python bot and press RUN ALGORITHM.' }
];

export default function TicTacToeArena() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.id || 'guest';
  const storageKey = (field) => `algo_ttt_py_${uid}_${field}`;

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

  const [pyReady, setPyReady] = useState(false);
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

  const addLog = useCallback((type, text, boardSnapshot = null) => {
    setLogs((prev) => [...prev, { type, text, boardSnapshot }]);
  }, []);
  const clearLogs = () => setLogs([]);

  const initWorker = useCallback(() => {
    workerRef.current?.terminate();
    setPyReady(false);
    const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const w = new Worker(url);
    URL.revokeObjectURL(url);

    w.onmessage = (e) => {
      if (e.data.mode === 'ready') {
        setPyReady(true);
      }
    };
    w.postMessage({ mode: 'init' });
    workerRef.current = w;
    return w;
  }, []);

  useEffect(() => {
    initWorker();
    return () => workerRef.current?.terminate();
  }, [initWorker]);

  useEffect(() => {
    if (!confirmResetCode) return;
    const t = setTimeout(() => setConfirmResetCode(false), 3000);
    return () => clearTimeout(t);
  }, [confirmResetCode]);

  const logStdout = (stdout) => {
    if (!stdout) return;
    stdout
      .split('\n')
      .filter((line) => line.trim() !== '')
      .forEach((line) => addLog('stdout', `[print] ${line}`));
  };

  const triggerBotMove = (currentBoard, botMark) => {
    const w = workerRef.current || initWorker();
    setBotThinking(true);

    const timeoutMs = pyReady ? 10000 : 25000;
    const timer = setTimeout(() => {
      addLog('error', 'Timeout (>10s) during live match. Check for infinite loops or optimize your search.');
      setStatusText('Bot timed out!');
      setGameOver(true);
      setBotThinking(false);
      initWorker();
    }, timeoutMs);

    w.onmessage = (e) => {
      if (e.data.mode === 'ready') {
        setPyReady(true);
        return;
      }
      clearTimeout(timer);
      setPyReady(true);
      setBotThinking(false);
      logStdout(e.data.stdout);

      if (e.data.mode === 'error') {
        addLog('error', e.data.message);
        setStatusText('Bot crashed!');
        setGameOver(true);
        return;
      }

      if (e.data.mode === 'single_move') {
        const idx = e.data.move;
        if (!e.data.is_valid_int || idx < 0 || idx > 8 || currentBoard[idx] !== null) {
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

    w.postMessage({
      mode: 'single_move',
      code,
      helpers: PYTHON_HELPERS,
      board: currentBoard,
      botMark
    });
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

    const { error } = await supabase.from('user_progress').upsert(
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

    if (error) {
      addLog('error', `Cloud save warning: ${error.message}`);
    }
  };

  const handleRun = () => {
    if (verifying || botThinking) return;
    const w = workerRef.current || initWorker();
    setVerifying(true);
    clearLogs();
    addLog(
      'info',
      pyReady
        ? 'Running 16-match Python verification suite (8 as X, 8 as O)...'
        : 'Downloading Python 3 runtime (first run only) & running verification...'
    );

    const timeoutMs = pyReady ? 20000 : 35000;
    const timer = setTimeout(() => {
      addLog('error', 'Verification timed out (>20s). Check for infinite loops or add Alpha-Beta pruning.');
      setVerifying(false);
      initWorker();
    }, timeoutMs);

    w.onmessage = async (e) => {
      if (e.data.mode === 'ready') {
        setPyReady(true);
        return;
      }
      clearTimeout(timer);
      setPyReady(true);

      const { passed, message, elapsed, boardSnapshot } = e.data;
      const speedSuffix = passed && elapsed != null ? ` (${elapsed.toFixed(1)} ms)` : '';
      addLog(passed ? 'success' : 'error', `${message}${speedSuffix}`, boardSnapshot || null);

      if (passed) {
        await saveVerifiedProgress(elapsed);
      }

      startFreshMatch(botStarts);
      setVerifying(false);
    };

    w.postMessage({
      mode: 'verify',
      code,
      helpers: PYTHON_HELPERS
    });
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
    addLog('info', 'Editor restored to Python starter template.');
  };

  const controlsLocked = verifying || botThinking;

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
          disabled={controlsLocked}
          className={`flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl font-bold transition shadow-xl ${
            controlsLocked
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
              <span>bot_logic.py</span>
              <span
                className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${
                  pyReady
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50'
                    : 'bg-amber-950/80 text-amber-300 border border-amber-700/50'
                }`}
              >
                {!pyReady && <Loader2 className="w-3 h-3 animate-spin" />}
                {pyReady ? 'Python 3 Ready' : 'Loading Python...'}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleResetCode}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition ${
                  confirmResetCode
                    ? 'bg-rose-600 text-white font-bold'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                }`}
                title="Restore Python starter code"
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
              defaultLanguage="python"
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 15,
                fontFamily: '"Fira Code", monospace',
                padding: { top: 16 },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 4,
                insertSpaces: true
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
                        : log.type === 'stdout'
                        ? 'text-sky-300'
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
              disabled={controlsLocked}
              onClick={() => {
                setBotStarts(false);
                startFreshMatch(false);
              }}
              className={`px-5 py-2.5 rounded-lg font-bold text-sm transition disabled:opacity-50 ${
                !botStarts ? 'bg-orange-600 text-white' : 'text-stone-400 hover:text-white'
              }`}
            >
              You Start (X)
            </button>
            <button
              disabled={controlsLocked}
              onClick={() => {
                setBotStarts(true);
                startFreshMatch(true);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition disabled:opacity-50 ${
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
                  disabled={gameOver || controlsLocked || cell !== null}
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
            disabled={controlsLocked}
            onClick={() => startFreshMatch(botStarts)}
            className="flex items-center gap-2 text-stone-400 hover:text-white font-semibold transition disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" /> Reset Board
          </button>
        </section>
      </main>
    </div>
  );
}
