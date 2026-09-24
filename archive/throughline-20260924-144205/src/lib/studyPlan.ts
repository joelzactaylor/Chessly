import type { Line } from './types';
import type { LineState } from './srs';
import { nodeFrequency } from './frequency';

/** Rank the common new decisions taught, rather than the probability of a whole deep leaf. */
export function studyPicks(lines: Line[], learned: Record<string, number>, states: Record<string, LineState>, limit = 3): Line[] {
  const familiar = new Set<string>();
  for (const line of lines) if (learned[line.id] || states[line.id]) for (const node of line.nodes) if (node.userMove) familiar.add(`${line.courseId}/${node.parent!.key}`);
  const remaining = lines.filter((line) => !learned[line.id] && !states[line.id]);
  const courseLines = new Map<string, Line[]>();
  for (const line of lines) { const pool = courseLines.get(line.courseId) ?? []; pool.push(line); courseLines.set(line.courseId, pool); }
  const picked: Line[] = [];
  while (picked.length < limit && remaining.length) {
    let best = 0; let score = -1;
    remaining.forEach((line, index) => {
      const boundary = line.nodes.findIndex((node) => /Engine illustration, not a measured/.test(node.comment ?? ''));
      const measured = boundary >= 0 ? line.nodes.slice(0, boundary) : line.nodes;
      const fresh = measured.filter((node) => node.userMove && !familiar.has(`${line.courseId}/${node.parent!.key}`));
      const value = fresh.reduce((sum, node) => sum + nodeFrequency(node, line.courseId, courseLines.get(line.courseId)!) / Math.sqrt(Math.max(1, node.ply)), 0) / Math.sqrt(Math.max(1, fresh.length));
      if (value > score) { score = value; best = index; }
    });
    const line = remaining.splice(best, 1)[0];
    picked.push(line);
    for (const node of line.nodes) if (node.userMove) familiar.add(`${line.courseId}/${node.parent!.key}`);
  }
  return picked;
}
