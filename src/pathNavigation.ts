import { lineKey, type Course, type Lesson, type PathTile, type Progress } from './library';
export function tileUrl(course: string, study: string, tile: string) {
  return `#/path/${course}/${study}/${tile}`;
}
export function sourceTileUrl(course: string, study: Lesson, tile: PathTile) {
  const base = `https://chessly.com/courses/${course}/chapters/${study.chapterId}/studies/${study.id}`;
  const index = study.tiles.filter(t => t.kind !== 'video').findIndex(t => t.id === tile.id);
  return `${base}/tiles/${index}?tileId=${tile.id}`;
}
export function tileComplete(course: string, tile: PathTile, progress: Progress) {
  return !!progress.tiles?.[lineKey(course, tile.id)];
}
export function tileAvailable(course: Course, tile: PathTile, progress: Progress) {
  const study = course.lessons.find(s => s.tiles.some(t => t.id === tile.id));
  if (!study) return false;
  const required = study.tiles.filter(t => t.required);
  const lastCompleted = required.reduce((last, t, i) => tileComplete(course.id, t, progress) ? i : last, -1);
  return !tile.required || required.findIndex(t => t.id === tile.id) <= lastCompleted + 1;
}
export function nextTile(course: Course, progress: Progress) {
  for (const study of course.lessons) {
    const tile = study.tiles?.find(t => t.required && !tileComplete(course.id, t, progress));
    if (tile) return { study, tile };
  }
  return null;
}
export interface SessionStep { variationId: string; guided: boolean }
export function tileSteps(tile: PathTile): SessionStep[] {
  if (tile.newVariations.length) return tile.newVariations.flatMap(variationId => [
    { variationId, guided: true }, { variationId, guided: false },
  ]);
  return tile.reviewVariations.map(variationId => ({ variationId, guided: false }));
}
export function shuffled<T>(values: T[], random = Math.random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
