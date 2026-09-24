import { courses } from '../data';
import { parseCourse } from '../lib/tree';
import type { Course, Line, ParsedChapter, ParsedCourse } from '../lib/types';
import { loadCache } from './lichessCache';

export interface PosStats { games: number; moves: Record<string, number>; score: Record<string, number> }

/** Only fresh browser data; there is no bundled snapshot fallback. */
export const stats: Record<string, PosStats> = new Proxy({} as Record<string, PosStats>, {
  get(_target, key: string) {
    if (typeof key !== 'string') return undefined;
    return loadCache()[key];
  },
});

export const parsedCourses: ParsedCourse[] = courses.map(parseCourse);
export const allLines: Line[] = parsedCourses.flatMap((c) => c.lines);

/** Replace the live catalog when a builder checkpoint publishes new finished lines. */
export function refreshCourses(next: Course[]) {
  courses.splice(0, courses.length, ...next);
  const parsed = next.map(parseCourse);
  parsedCourses.splice(0, parsedCourses.length, ...parsed);
  allLines.splice(0, allLines.length, ...parsed.flatMap((course) => course.lines));
}

export function getCourse(id: string): ParsedCourse | undefined {
  return parsedCourses.find((c) => c.course.id === id);
}
export function getChapter(courseId: string, chapterId: string): ParsedChapter | undefined {
  return getCourse(courseId)?.chapters.find((c) => c.chapter.id === chapterId);
}
export function lineById(id: string): Line | undefined {
  return allLines.find((l) => l.id === id);
}
export function lineIndexInChapter(line: Line): number {
  const ch = getChapter(line.courseId, line.chapterId);
  return ch ? ch.lines.indexOf(line) : 0;
}

if (import.meta.env?.DEV) {
  for (const c of parsedCourses) for (const e of c.errors) console.warn(`[${c.course.id}] ${e}`);
}
