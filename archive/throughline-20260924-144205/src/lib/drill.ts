import { isDue, masteryOf, type LineState } from './srs';
import type { Line } from './types';
import type { MoveStat } from '../state/store';
import { weakLines } from '../state/selectors';
import { lineFrequency, nodeFrequency } from './frequency';
import type { RepNode } from './types';

export interface PosStatsLite { moves: Record<string, number> }

function learningValue(line: Line, pool: Line[]): number {
  return line.nodes
    .filter((node) => node.userMove)
    .reduce((sum, node) => sum + nodeFrequency(node, line.courseId, pool) / Math.sqrt(Math.max(1, node.ply)), 0);
}

export type QueueMode = 'due' | 'weak' | 'course' | 'chapter' | 'line' | 'all' | 'mixed' | 'mixed-course' | 'mixed-chapter';

/**
 * Orders lines for a practice session. Due lines come first (most overdue first),
 * then new lines in course order, then the rest by how shaky they are.
 */
export function orderForPractice(lines: Line[], states: Record<string, LineState>, now = Date.now()): Line[] {
  // Rank common learner decisions, not only the probability of a deep leaf line.
  const freq = new Map(lines.map((l) => [l.id, lineFrequency(l, lines)]));
  const byFreq = (a: Line, b: Line) => (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0);
  const byLearningValue = (a: Line, b: Line) => learningValue(b, lines) - learningValue(a, lines) || byFreq(a, b);
  const due = lines.filter((l) => isDue(states[l.id], now)).sort((a, b) => {
    // Overdue by a lot and common beats slightly overdue and rare.
    const oa = (now - states[a.id].due) / 86_400_000 + 1;
    const ob = (now - states[b.id].due) / 86_400_000 + 1;
    return ob * (freq.get(b.id) ?? 0) - oa * (freq.get(a.id) ?? 0);
  });
  const fresh = lines.filter((l) => masteryOf(states[l.id]) === 'new').sort(byLearningValue);
  const rest = lines.filter((l) => !due.includes(l) && !fresh.includes(l));
  const bucket = (l: Line) => { const m = masteryOf(states[l.id]); return m === 'learning' ? 0 : m === 'familiar' ? 1 : 2; };
  rest.sort((a, b) => bucket(a) - bucket(b) || byLearningValue(a, b));
  return [...due, ...fresh, ...rest];
}

export function buildQueue(mode: QueueMode, pool: Line[], states: Record<string, LineState>, moves: Record<string, MoveStat>): Line[] {
  switch (mode) {
    case 'due': return orderForPractice(pool.filter((l) => isDue(states[l.id])), states);
    case 'weak': return weakLines(pool, moves).map((w) => w.line).sort((a, b) => learningValue(b, pool) - learningValue(a, pool));
    case 'line': return pool;
    default: return orderForPractice(pool, states);
  }
}

/**
 * Mixed practice: walk the tree from the root and let the opponent pick a reply at every
 * branch point — weighted by how often club players actually play it (Lichess stats when
 * available), with a bonus for replies whose lines you have not mastered yet — and return
 * the leaf line reached. The learner never knows which line is coming.
 */
export function sampleLineByWalk(lines: Line[], states: Record<string, LineState>, stats: Record<string, PosStatsLite>): Line | undefined {
  if (!lines.length) return undefined;
  let node: RepNode = lines[0].nodes[0].parent!; // the chapter root
  const inPool = new Set(lines);
  const linesUnder = (n: RepNode) => lines.filter((l) => inPool.has(l) && l.nodes.includes(n));
  while (node.children.length) {
    const kids = node.children.filter((c) => linesUnder(c).length > 0);
    if (!kids.length) break;
    if (kids.length === 1 || kids[0].userMove) { node = kids[0]; continue; }
    const st = stats[node.key];
    const weights = kids.map((c) => {
      const freq = st?.moves[c.san];
      let w = freq !== undefined ? Math.max(freq, 3) : 100 / kids.length;
      const under = linesUnder(c);
      const unmastered = under.filter((l) => masteryOf(states[l.id]) !== 'mastered').length;
      w *= 1 + unmastered / Math.max(1, under.length); // up to 2× for fully unmastered branches
      return w;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let pick = kids[kids.length - 1];
    for (let i = 0; i < kids.length; i++) { r -= weights[i]; if (r <= 0) { pick = kids[i]; break; } }
    node = pick;
  }
  return lines.find((l) => l.nodes[l.nodes.length - 1] === node) ?? lines[0];
}

/** A mixed-practice queue: `n` sampled lines, avoiding immediate repeats where possible. */
export function mixedQueue(lines: Line[], states: Record<string, LineState>, stats: Record<string, PosStatsLite>, n: number): Line[] {
  const out: Line[] = [];
  const byChapter = new Map<string, Line[]>();
  for (const l of lines) {
    const k = `${l.courseId}/${l.chapterId}`;
    if (!byChapter.has(k)) byChapter.set(k, []);
    byChapter.get(k)!.push(l);
  }
  const chapters = [...byChapter.values()];
  for (let i = 0; i < n && chapters.length; i++) {
    // Pick a chapter weighted by its number of lines, then walk its tree.
    const total = lines.length;
    let r = Math.random() * total;
    let ch = chapters[0];
    for (const c of chapters) { r -= c.length; if (r <= 0) { ch = c; break; } }
    let pick = sampleLineByWalk(ch, states, stats);
    if (pick && out.length && pick === out[out.length - 1] && lines.length > 1) pick = sampleLineByWalk(ch, states, stats);
    if (pick) out.push(pick);
  }
  return out;
}

export interface QuizItem { node: RepNode; line: Line }

/** Quiz items for specific position keys (learner to move). */
export function quizItemsForKeys(lines: Line[], keys: string[]): QuizItem[] {
  const out: QuizItem[] = [];
  for (const key of keys) {
    for (const line of lines) {
      const node = line.nodes.find((n) => n.userMove && n.parent!.key === key);
      if (node) { out.push({ node, line }); break; }
    }
  }
  return out;
}

/** Positions (learner to move) for a quick-fire quiz, drawn from the given lines. */
export function quizItems(lines: Line[], n: number, minPly = 2): QuizItem[] {
  const seen = new Set<string>();
  const pool: Array<QuizItem & { w: number }> = [];
  for (const line of lines) {
    for (const node of line.nodes) {
      if (!node.userMove || node.ply < minPly) continue;
      const k = node.parent!.key;
      if (seen.has(k)) continue;
      seen.add(k);
      // Weight by how often the position actually arises (square root so rare lines still appear sometimes).
      pool.push({ node, line, w: Math.sqrt(nodeFrequency(node, line.courseId, lines.filter((l) => l.courseId === line.courseId))) });
    }
  }
  const out: QuizItem[] = [];
  const remaining = [...pool];
  while (out.length < n && remaining.length) {
    const total = remaining.reduce((a, x) => a + x.w, 0);
    let r = Math.random() * total;
    let idx = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) { r -= remaining[i].w; if (r <= 0) { idx = i; break; } }
    const [pick] = remaining.splice(idx, 1);
    out.push({ node: pick.node, line: pick.line });
  }
  return out;
}
