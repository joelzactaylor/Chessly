/**
 * Grades every learner move in the repertoire with Stockfish: compares the eval of the
 * recommended move against the engine's best move and flags drops above a threshold.
 * Also reports the eval at the end of every line, from the learner's point of view.
 *
 * Usage: npx tsx scripts/engine-check.ts [courseId] [depth=20] [flagCp=45]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Chess } from 'chess.js';
import { courses } from '../src/data';
import { parseCourse, walk, pathString } from '../src/lib/tree';
import { Engine, type PvLine } from './engine';
import type { RepNode } from '../src/lib/types';

const onlyCourses = process.argv[2] && process.argv[2] !== '-' ? process.argv[2].split(',') : undefined;
const depth = parseInt(process.argv[3] ?? '20', 10);
const flagCp = parseInt(process.argv[4] ?? '45', 10);
const chapterFilter = process.argv[5];
const WORKERS = 4;

function cpOf(l: PvLine): number {
  if (l.mate !== null) return l.mate > 0 ? 10000 - l.mate : -10000 - l.mate;
  return l.scoreCp ?? 0;
}
function fmt(cp: number): string {
  if (cp > 9000) return `#${10000 - cp}`;
  if (cp < -9000) return `#-${-10000 - cp}`;
  return (cp / 100).toFixed(2);
}
function toSan(fen: string, uci: string[]): string {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const u of uci.slice(0, 6)) {
    const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    if (!m) break;
    out.push(m.san);
  }
  return out.join(' ');
}

interface Task { node: RepNode; course: string; chapter: string }
const tasks: Task[] = [];
const seenMoves = new Set<string>();
const leaves: Task[] = [];
for (const course of courses) {
  if (onlyCourses && !onlyCourses.includes(course.id)) continue;
  const parsed = parseCourse(course);
  for (const ch of parsed.chapters) {
    if (chapterFilter && !ch.chapter.id.includes(chapterFilter)) continue;
    walk(ch.root, (n) => {
      if (n.userMove) {
        const k = n.parent!.key + n.san; // the same position reached by a different order is checked once
        if (seenMoves.has(k)) return;
        seenMoves.add(k);
        tasks.push({ node: n, course: course.id, chapter: ch.chapter.title });
      }
      if (n.parent && !n.children.length) leaves.push({ node: n, course: course.id, chapter: ch.chapter.title });
    });
  }
}
console.log(`Checking ${tasks.length} learner moves and ${leaves.length} line endings at depth ${depth} with ${WORKERS} engines…`);

interface Finding { kind: 'move' | 'leaf'; course: string; chapter: string; path: string; drop?: number; ours?: string; best?: string; bestLine?: string; evalUser?: number }
const findings: Finding[] = [];
let done = 0;
const start = Date.now();

async function worker(id: number) {
  const eng = new Engine('stockfish', 2, 256);
  // Evaluate the parent position (best move) and the position after our move.
  const my = tasks.filter((_, i) => i % WORKERS === id);
  for (const t of my) {
    const parent = t.node.parent!;
    const best = await eng.analyse(parent.fen, depth);
    const after = await eng.analyse(t.node.fen, depth);
    if (!best.length || !after.length) continue;
    const bestCp = cpOf(best[0]);
    const ourCp = -cpOf(after[0]); // from the learner's side
    const drop = bestCp - ourCp;
    const bestUci = best[0].pv[0];
    if (bestUci !== t.node.uci && drop >= flagCp) {
      findings.push({
        kind: 'move', course: t.course, chapter: t.chapter, path: pathString(parent),
        drop, ours: `${t.node.san} (${fmt(ourCp)})`, best: `${toSan(parent.fen, [bestUci])} (${fmt(bestCp)})`,
        bestLine: toSan(parent.fen, best[0].pv),
      });
    }
    done++;
    if (done % 25 === 0) process.stdout.write(`  ${done}/${tasks.length} (${Math.round((Date.now() - start) / 1000)}s)\n`);
  }
  const myLeaves = leaves.filter((_, i) => i % WORKERS === id);
  for (const t of myLeaves) {
    const r = await eng.analyse(t.node.fen, depth);
    if (!r.length) continue;
    const side = courses.find((c) => c.id === t.course)!.side;
    const turn = t.node.fen.split(' ')[1];
    const cp = cpOf(r[0]) * (turn === side ? 1 : -1);
    findings.push({ kind: 'leaf', course: t.course, chapter: t.chapter, path: pathString(t.node), evalUser: cp, bestLine: toSan(t.node.fen, r[0].pv) });
  }
  eng.quit();
}

await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)));

const moveFindings = findings.filter((f) => f.kind === 'move').sort((a, b) => (b.drop ?? 0) - (a.drop ?? 0));
const leafFindings = findings.filter((f) => f.kind === 'leaf').sort((a, b) => (a.evalUser ?? 0) - (b.evalUser ?? 0));
console.log(`\n=== Learner moves worse than best by ≥ ${flagCp}cp: ${moveFindings.length} ===`);
for (const f of moveFindings) {
  console.log(`\n[${f.course}] ${f.chapter}\n  after ${f.path}\n  ours: ${f.ours}   best: ${f.best}  (drop ${((f.drop ?? 0) / 100).toFixed(2)})\n  best line: ${f.bestLine}`);
}
console.log(`\n=== Line endings, worst first (eval from your side) ===`);
for (const f of leafFindings.slice(0, 40)) {
  console.log(`  ${fmt(f.evalUser ?? 0).padStart(6)}  [${f.course}] ${f.path}`);
}
mkdirSync('scripts/out', { recursive: true });
writeFileSync(`scripts/out/engine-check-${onlyCourses?.join('+') ?? 'all'}.json`, JSON.stringify({ depth, flagCp, moveFindings, leafFindings }, null, 2));
console.log(`\nDone in ${Math.round((Date.now() - start) / 1000)}s. Full report: scripts/out/engine-check-${onlyCourses?.join('+') ?? 'all'}.json`);
