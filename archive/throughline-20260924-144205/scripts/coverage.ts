/**
 * For every position in the repertoire where the OPPONENT is to move, ask the Lichess
 * explorer (1600–2000, blitz/rapid/classical) what people actually play and report the
 * replies we do not cover. Run: npx tsx scripts/coverage.ts [courseId] [minPct]
 */
import { courses } from '../src/data';
import { parseCourse, walk, pathString } from '../src/lib/tree';
import { explorer, loadToken, total } from './explorer';
import type { RepNode } from '../src/lib/types';

const onlyCourse = process.argv[2];
const minPct = parseFloat(process.argv[3] ?? '1');
if (!loadToken()) {
  console.error('No Lichess token. Put one in .lichess-token or LICHESS_TOKEN.');
  process.exit(1);
}

for (const course of courses) {
  if (onlyCourse && course.id !== onlyCourse) continue;
  const parsed = parseCourse(course);
  console.log(`\n=== ${course.title} ===`);
  for (const ch of parsed.chapters) {
    const gaps: string[] = [];
    let weighted = 0;
    let count = 0;
    const nodes: RepNode[] = [];
    walk(ch.root, (n) => {
      const oppToMove = n.children.length > 0 && !n.children[0].userMove;
      if (oppToMove) nodes.push(n);
    });
    for (const n of nodes) {
      const r = await explorer(n.fen);
      if (!r) continue;
      const t = total(r);
      if (t < 200) continue; // too few games to matter
      const covered = new Set(n.children.map((c) => c.san));
      let coveredPct = 0;
      const missing: string[] = [];
      for (const m of r.moves) {
        const pct = (100 * total(m)) / t;
        if (covered.has(m.san)) coveredPct += pct;
        else if (pct >= minPct) missing.push(`${m.san} ${pct.toFixed(0)}%`);
      }
      weighted += coveredPct;
      count++;
      if (missing.length) gaps.push(`   ${pathString(n)}  [${t.toLocaleString()} games, ${coveredPct.toFixed(0)}% covered] missing: ${missing.join(', ')}`);
    }
    console.log(` ${ch.chapter.title}: avg coverage ${(count ? weighted / count : 0).toFixed(0)}% over ${count} positions`);
    for (const g of gaps) console.log(g);
  }
}
