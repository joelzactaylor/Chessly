/**
 * Browser Stockfish (single-threaded WASM build, ~7 MB, loaded once on first use) for the
 * eval bar. One shared worker; requests are debounced and the newest position wins.
 */
export interface EngineEval {
  /** Centipawns from White's point of view, or null when it is a mate score. */
  cp: number | null;
  /** Mate in N from White's point of view (negative = Black mates). */
  mate: number | null;
  depth: number;
  /** Principal variation in UCI. */
  pv: string[];
}

type Listener = (e: EngineEval) => void;

let worker: Worker | null = null;
let ready = false;
let readyWaiters: Array<() => void> = [];
let currentFen = '';
let listener: Listener | null = null;
let searching = false;
let pending: string | null = null;

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker('/engine/stockfish.js');
  worker.onmessage = (ev: MessageEvent) => onLine(typeof ev.data === 'string' ? ev.data : String(ev.data));
  worker.postMessage('uci');
  return worker;
}

function onLine(line: string) {
  if (line === 'uciok') {
    worker!.postMessage('setoption name UCI_AnalyseMode value true');
    worker!.postMessage('isready');
    return;
  }
  if (line === 'readyok') {
    ready = true;
    readyWaiters.forEach((f) => f());
    readyWaiters = [];
    return;
  }
  if (line.startsWith('bestmove')) {
    searching = false;
    if (pending) { const f = pending; pending = null; start(f); }
    return;
  }
  if (line.startsWith('info') && line.includes(' pv ') && !line.includes('lowerbound') && !line.includes('upperbound')) {
    const depth = parseInt(line.match(/ depth (\d+)/)?.[1] ?? '0', 10);
    const cpM = line.match(/ score cp (-?\d+)/);
    const mateM = line.match(/ score mate (-?\d+)/);
    const pv = line.split(' pv ')[1].trim().split(' ');
    const whiteToMove = currentFen.split(' ')[1] === 'w';
    const sign = whiteToMove ? 1 : -1;
    const e: EngineEval = {
      cp: cpM ? sign * parseInt(cpM[1], 10) : null,
      mate: mateM ? sign * parseInt(mateM[1], 10) : null,
      depth,
      pv,
    };
    listener?.(e);
  }
}

function start(fen: string) {
  const w = ensureWorker();
  currentFen = fen;
  searching = true;
  w.postMessage(`position fen ${fen}`);
  w.postMessage(`go depth ${MAX_DEPTH}`);
}

const MAX_DEPTH = 18;

/** Analyse `fen`; `onEval` receives progressively deeper evaluations. */
export function analyse(fen: string, onEval: Listener) {
  listener = onEval;
  const w = ensureWorker();
  const go = () => {
    if (searching) { pending = fen; w.postMessage('stop'); }
    else start(fen);
  };
  if (ready) go();
  else readyWaiters.push(go);
}

export function stopAnalysis() {
  listener = null;
  pending = null;
  if (worker && searching) worker.postMessage('stop');
}

export function isEngineLoaded() { return ready; }
