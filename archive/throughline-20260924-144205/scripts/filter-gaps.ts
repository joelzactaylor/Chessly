/**
 * Reads a pasted gap list (Settings → Copy full list) and sorts it into:
 *  - transpositions: the reply leads into a position the repertoire already answers (auto-fixable)
 *  - real gaps: replies with no answer anywhere
 * Usage: npx tsx scripts/filter-gaps.ts gaps.txt [minPct] [minGames]
 */
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { parsedCourses } from '../src/state/courses';
import { walk } from '../src/lib/tree';
import { posKey } from '../src/lib/chessUtils';
import type { RepNode } from '../src/lib/types';

const minPct = parseFloat(process.argv[3] ?? '1');
const minGames = parseInt(process.argv[4] ?? '20000', 10);

const covered = new Map<string, Set<string>>();
const learnerMove = new Map<string, { node: RepNode; course: string; chapter: string }>();
const oppNodes = new Map<string, { course: string; chapter: string }>();
for (const pc of parsedCourses) for (const ch of pc.chapters) walk(ch.root, (n) => {
  if (!n.children.length) return;
  if (n.children[0].userMove) { if (!learnerMove.has(n.key)) learnerMove.set(n.key, { node: n.children[0], course: pc.course.id, chapter: ch.chapter.title }); return; }
  if (!covered.has(n.key)) { covered.set(n.key, new Set()); oppNodes.set(n.key, { course: pc.course.id, chapter: ch.chapter.title }); }
  for (const x of n.children) covered.get(n.key)!.add(x.san);
});

const lines = readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean);
const trans: string[] = [];
const real: Array<{ san: string; pct: number; path: string; games: number; course: string; chapter: string }> = [];
for (const l of lines) {
  const m = l.match(/^(\S+) (\d+)% after (.+) \((\d+) games\)$/);
  if (!m) continue;
  const [, san, pct, path, games] = m;
  if (+pct < minPct || +games < minGames) continue;
  const c = new Chess();
  if (path !== 'the starting position') for (const t of path.split(' ')) { const s = t.replace(/^\d+\.(\.\.)?/, ''); if (s) c.move(s); }
  const key = posKey(c.fen());
  if (learnerMove.has(key) || !covered.has(key) || covered.get(key)!.has(san)) continue;
  const where = oppNodes.get(key)!;
  const after = new Chess(c.fen());
  const mv = after.move(san);
  if (!mv) continue;
  const target = learnerMove.get(posKey(after.fen()));
  const num = c.turn() === 'w' ? `${c.moveNumber()}.` : `${c.moveNumber()}...`;
  if (target) {
    const reply = target.node;
    trans.push(`[${where.course}] ${path === 'the starting position' ? '' : path + ' '}${num}${san} {Transposes.} ${reply.color === 'w' ? `${reply.moveNumber}.` : `${reply.moveNumber}...`}${reply.san}   (${pct}%, → ${target.chapter})`);
  } else real.push({ san, pct: +pct, path, games: +games, course: where.course, chapter: where.chapter });
}
real.sort((a, b) => b.pct * Math.log(b.games) - a.pct * Math.log(a.games));
console.log(`=== Transpositions (${trans.length}) ===`);
for (const t of trans) console.log(t);
console.log(`\n=== Real gaps (${real.length}) ===`);
for (const g of real) console.log(`[${g.course}] ${g.san} ${g.pct}% after ${g.path} (${g.games.toLocaleString()})`);
