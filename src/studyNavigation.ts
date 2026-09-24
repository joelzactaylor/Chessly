import type { CourseLine } from "./library";
/** Keep the position shared by the current and destination variation. */
export function sharedPly(current: CourseLine, next: CourseLine, ply: number) {
  let n = 0;
  while (
    n < ply &&
    n < current.sans.length &&
    n < next.sans.length &&
    current.sans[n] === next.sans[n]
  )
    n++;
  return n;
}
export function continuations(
  lines: CourseLine[],
  current: CourseLine,
  ply: number,
) {
  const choices = new Map<
    string,
    { san: string; lineIndex: number; variations: number[] }
  >();
  lines.forEach((line, i) => {
    if (sharedPly(current, line, ply) !== ply || !line.sans[ply]) return;
    const san = line.sans[ply];
    const found = choices.get(san);
    if (found) found.variations.push(i);
    else choices.set(san, { san, lineIndex: i, variations: [i] });
  });
  return [...choices.values()];
}
export function lessonUrl(
  mode: string,
  course: string,
  study: string,
  line: number,
  ply = 0,
) {
  return `#/${mode}/${course}/${study}/${line}${ply > 0 && mode !== "drill" ? `?ply=${ply}` : ""}`;
}
