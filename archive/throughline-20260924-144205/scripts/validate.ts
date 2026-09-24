/**
 * Parses every course, reports illegal moves, single-move violations and
 * cross-chapter conflicts, then prints a size summary. Run: npm run validate
 */
import { courses } from '../src/data';
import { parseCourse, countNodes } from '../src/lib/tree';

let failed = false;
let grandLines = 0;
let grandUser = 0;

for (const course of courses) {
  const parsed = parseCourse(course);
  const totalNodes = parsed.chapters.reduce((a, c) => a + countNodes(c.root).total, 0);
  const userNodes = parsed.chapters.reduce((a, c) => a + countNodes(c.root).user, 0);
  grandLines += parsed.lines.length;
  grandUser += userNodes;
  console.log(`\n${course.side === 'w' ? '♔' : '♚'} ${course.title}: ${parsed.chapters.length} chapters, ${parsed.lines.length} lines, ${totalNodes} moves (${userNodes} yours)`);
  for (const ch of parsed.chapters) {
    const depth = Math.max(0, ...ch.lines.map((l) => l.nodes.length));
    console.log(`   · ${ch.chapter.title}: ${ch.lines.length} lines, deepest ${Math.ceil(depth / 2)} moves`);
  }
  if (parsed.errors.length) {
    failed = true;
    for (const e of parsed.errors) console.log(`   ✗ ${e}`);
  }
}
console.log(`\nTotal: ${grandLines} lines, ${grandUser} learner moves`);
if (failed) {
  console.log('\nValidation FAILED');
  process.exit(1);
}
console.log('All courses valid ✓');
