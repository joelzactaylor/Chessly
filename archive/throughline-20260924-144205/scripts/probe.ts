/** Usage: npx tsx scripts/probe.ts "1.e4 e5 2.Nc3 Nf6 3.f4 d5" [depth]  — prints the top 3 engine lines in SAN. */
import { Chess } from 'chess.js';
import { Engine, scoreToString } from './engine';

const movesArg = process.argv[2] ?? '';
const depth = parseInt(process.argv[3] ?? '22', 10);
const chess = new Chess();
for (const tok of movesArg.split(/\s+/).filter(Boolean)) {
  const san = tok.replace(/^\d+\.(\.\.)?/, '');
  if (!san) continue;
  const m = chess.move(san);
  if (!m) { console.error('Illegal:', tok); process.exit(1); }
}
const fen = chess.fen();
const engine = new Engine('stockfish', 4, 256);
const lines = await engine.analyse(fen, depth);
console.log(`Position after: ${movesArg}  (${chess.turn() === 'w' ? 'White' : 'Black'} to move)`);
for (const l of lines) {
  const c = new Chess(fen);
  const sans: string[] = [];
  for (const u of l.pv.slice(0, 12)) {
    const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    if (!m) break;
    sans.push((m.color === 'w' ? `${c.moveNumber() }.` : '') + m.san);
  }
  console.log(`  ${scoreToString(l).padStart(6)}  ${sans.join(' ')}`);
}
engine.quit();
