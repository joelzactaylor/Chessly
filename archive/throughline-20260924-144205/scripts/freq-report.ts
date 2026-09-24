/** Prints, per course, the practice order the scheduler now uses (top 12 lines) and how many lines get cut at the default cutoff. */
import { parsedCourses } from '../src/state/courses';
import { lineFrequency, formatOdds, practicalLength } from '../src/lib/frequency';
for (const pc of parsedCourses) {
  const lines = [...pc.lines].sort((a, b) => lineFrequency(b, pc.lines) - lineFrequency(a, pc.lines));
  const cut = pc.lines.filter((l) => practicalLength(l, pc.lines, 0.005) < l.nodes.length).length;
  console.log(`\n${pc.course.title}: ${pc.lines.length} lines, ${cut} would be shortened at the 1-in-200 cutoff (bundled stats only — the app also uses your synced data)`);
  for (const l of lines.slice(0, 8)) console.log(`  ${formatOdds(lineFrequency(l, pc.lines)).padEnd(10)} ${pc.chapters.find((c) => c.chapter.id === l.chapterId)!.chapter.title.slice(0, 28).padEnd(30)} ${l.title}`);
}
