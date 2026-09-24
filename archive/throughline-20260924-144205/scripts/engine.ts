/** Thin UCI wrapper around the Stockfish binary for scripts. */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export interface PvLine { multipv: number; scoreCp: number | null; mate: number | null; pv: string[] }

export class Engine {
  private proc: ChildProcessWithoutNullStreams;
  private buffer = '';
  private waiters: Array<{ match: (line: string) => boolean; resolve: (lines: string[]) => void; lines: string[] }> = [];

  constructor(path = 'stockfish', threads = 1, hashMb = 128) {
    this.proc = spawn(path);
    this.proc.stdout.on('data', (d) => this.onData(d.toString()));
    this.send('uci');
    this.send(`setoption name Threads value ${threads}`);
    this.send(`setoption name Hash value ${hashMb}`);
    this.send('setoption name MultiPV value 3');
  }

  private onData(text: string) {
    this.buffer += text;
    const parts = this.buffer.split('\n');
    this.buffer = parts.pop() ?? '';
    for (const raw of parts) {
      const line = raw.trim();
      const w = this.waiters[0];
      if (!w) continue;
      w.lines.push(line);
      if (w.match(line)) {
        this.waiters.shift();
        w.resolve(w.lines);
      }
    }
  }

  send(cmd: string) { this.proc.stdin.write(cmd + '\n'); }

  private waitFor(match: (l: string) => boolean): Promise<string[]> {
    return new Promise((resolve) => this.waiters.push({ match, resolve, lines: [] }));
  }

  async ready() {
    this.send('isready');
    await this.waitFor((l) => l === 'readyok');
  }

  /** Analyse a position. Returns PV lines from the side-to-move's perspective. */
  async analyse(fen: string, depth: number, searchmoves?: string[]): Promise<PvLine[]> {
    await this.ready();
    this.send(`position fen ${fen}`);
    const p = this.waitFor((l) => l.startsWith('bestmove'));
    this.send(`go depth ${depth}${searchmoves?.length ? ' searchmoves ' + searchmoves.join(' ') : ''}`);
    const lines = await p;
    const byPv = new Map<number, PvLine>();
    for (const l of lines) {
      if (!l.startsWith('info') || !l.includes(' pv ')) continue;
      const m = l.match(/multipv (\d+)/);
      const mp = m ? parseInt(m[1], 10) : 1;
      const cp = l.match(/score cp (-?\d+)/);
      const mate = l.match(/score mate (-?\d+)/);
      const pv = l.split(' pv ')[1].trim().split(' ');
      byPv.set(mp, { multipv: mp, scoreCp: cp ? parseInt(cp[1], 10) : null, mate: mate ? parseInt(mate[1], 10) : null, pv });
    }
    return [...byPv.values()].sort((a, b) => a.multipv - b.multipv);
  }

  quit() { this.send('quit'); }
}

export function scoreToString(l: PvLine): string {
  if (l.mate !== null) return `#${l.mate}`;
  return ((l.scoreCp ?? 0) / 100).toFixed(2);
}
