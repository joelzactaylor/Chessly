/**
 * Builds src/data/stats.json: for each repertoire position (opponent to move), the
 * share of games in which each reply is played at 1600–2000 on Lichess, and the
 * learner's score with the repertoire move. Run: npx tsx scripts/build-stats.ts
 */
import { writeFileSync } from 'node:fs';
import { courses } from '../src/data';
import { parseCourse, walk } from '../src/lib/tree';
import { explorer, loadToken, total } from './explorer';

if (!loadToken()) {
  console.error('No Lichess token. Put one in .lichess-token or LICHESS_TOKEN.');
  process.exit(1);
}

export interface PosStats {
  games: number;
  /** san → percentage of games (0–100) */
  moves: Record<string, number>;
  /** san → white score percentage (white wins + half draws) */
  score: Record<string, number>;
}

const out: Record<string, PosStats> = {};
let n = 0;
for (const course of courses) {
  const parsed = parseCourse(course);
  for (const ch of parsed.chapters) {
    const todo: Array<{ key: string; fen: string }> = [];
    walk(ch.root, (node) => {
      if (node.children.length && !out[node.key]) todo.push({ key: node.key, fen: node.fen });
    });
    for (const { key, fen } of todo) {
      if (out[key]) continue;
      const r = await explorer(fen);
      if (!r) continue;
      const t = total(r);
      if (t < 50) continue;
      const moves: Record<string, number> = {};
      const score: Record<string, number> = {};
      for (const m of r.moves) {
        const mt = total(m);
        moves[m.san] = Math.round((1000 * mt) / t) / 10;
        score[m.san] = Math.round((1000 * (m.white + m.draws / 2)) / mt) / 10;
      }
      out[key] = { games: t, moves, score };
      n++;
      if (n % 25 === 0) console.log(`${n} positions…`);
    }
  }
}
writeFileSync('src/data/stats.json', JSON.stringify(out));
console.log(`Wrote stats for ${Object.keys(out).length} positions`);
