import type { Course } from '../lib/types';
import { loadGeneratedCourses } from '../lib/courseGenerator';
import { seedCourses } from './rules';

/** Read the hydrated IndexedDB mirror; seeds are an empty first-run shell. */
export const courses: Course[] = loadGeneratedCourses() ?? seedCourses();

export function courseById(id: string): Course | undefined {
  return courses.find((c) => c.id === id);
}
