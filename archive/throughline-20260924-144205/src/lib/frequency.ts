/**
 * How often will you actually reach a position or line? Multiply, along the path, the
 * share of games in which club players (Lichess 1600–2000) chose each opponent reply.
 * Positions without data fall back to an even split between the replies the repertoire
 * covers. Probabilities are relative to the course's entry position (e.g. "given that the
 * game started 1.e4 e5 2.Nc3"), so lines within a course compare fairly.
 */
import { stats } from '../state/courses';
import type { Line, RepNode } from './types';

const FLOOR = 0.4; // a reply with <0.4% (or missing from the stats) still counts a little

export function stepProbability(parent: RepNode, child: RepNode): number {
  if (child.userMove) return 1;
  const st = stats[parent.key];
  if (st && st.games >= 50) {
    const pct = st.moves[child.san];
    return Math.max(pct ?? FLOOR, FLOOR) / 100;
  }
  return 1 / Math.max(1, parent.children.length);
}

/** Probability of reaching `node` from the chapter root (absolute, not course-relative). */
export function reachProbability(node: RepNode): number {
  let p = 1;
  let n: RepNode | null = node;
  while (n && n.parent) { p *= stepProbability(n.parent, n); n = n.parent; }
  return p;
}

const entryCache = new Map<string, number>();
/** Probability of the course's entry position: the longest prefix every line in the course shares. */
export function courseEntryProbability(courseId: string, lines: Line[]): number {
  const cached = entryCache.get(courseId);
  if (cached !== undefined) return cached;
  if (!lines.length) return 1;
  let prefix = lines[0].nodes.map((n) => n.san);
  for (const l of lines) {
    let i = 0;
    while (i < prefix.length && i < l.nodes.length && l.nodes[i].san === prefix[i]) i++;
    prefix = prefix.slice(0, i);
  }
  const entry = prefix.length ? lines[0].nodes[prefix.length - 1] : null;
  const p = entry ? reachProbability(entry) : 1;
  entryCache.set(courseId, p);
  return p;
}
export function invalidateFrequencyCache() { entryCache.clear(); }

/** Probability that a game in this course follows the whole line (relative to the course entry). */
export function lineFrequency(line: Line, courseLines: Line[]): number {
  const example = line.nodes.findIndex((node) => /Engine illustration, not a measured/.test(node.comment ?? ''));
  // For scheduling, use the probability of reaching the example's entry only.
  const last = line.nodes[example > 0 ? example - 1 : line.nodes.length - 1];
  return reachProbability(last) / courseEntryProbability(line.courseId, courseLines);
}

export function lineFrequencyLabel(line: Line, courseLines: Line[]): string {
  if (line.nodes.some((node) => /Engine illustration, not a measured/.test(node.comment ?? ''))) return 'Includes engine example';
  return `≈ ${formatOdds(lineFrequency(line, courseLines))} games`;
}

/** Probability of reaching a node, relative to its course's entry. */
export function nodeFrequency(node: RepNode, courseId: string, courseLines: Line[]): number {
  return reachProbability(node) / courseEntryProbability(courseId, courseLines);
}

/** "1 in 12" style label. */
export function formatOdds(p: number): string {
  if (p >= 0.5) return 'most games';
  const n = Math.round(1 / Math.max(p, 1e-6));
  if (n >= 1000) return `1 in ${Math.round(n / 100) * 100}`;
  if (n >= 100) return `1 in ${Math.round(n / 10) * 10}`;
  return `1 in ${n}`;
}

/**
 * The ply after which a line becomes rarer than `cutoff` (relative to the course entry):
 * drilling stops after the last learner move that is still at least that common.
 * Returns the number of nodes to keep (nodes.length when nothing is cut).
 */
export function practicalLength(line: Line, courseLines: Line[], cutoff: number): number {
  if (cutoff <= 0) return line.nodes.length;
  const entry = courseEntryProbability(line.courseId, courseLines);
  let p = 1;
  let keep = 0;
  for (let i = 0; i < line.nodes.length; i++) {
    const n = line.nodes[i];
    p *= stepProbability(n.parent!, n);
    if (p / entry < cutoff && n.userMove === false) {
      // The opponent just played something rarer than the cutoff: stop before answering it,
      // unless nothing has been kept yet (always practise at least one move).
      return keep > 0 ? keep : line.nodes.length;
    }
    if (n.userMove) keep = i + 1;
  }
  return line.nodes.length;
}
