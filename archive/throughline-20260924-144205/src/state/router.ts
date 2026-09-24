import { useEffect, useState } from 'react';

export type DrillMode = 'due' | 'course' | 'chapter' | 'line' | 'weak' | 'all' | 'mixed' | 'mixed-course' | 'mixed-chapter';

export type QuizScope = 'all' | 'course' | 'missed' | 'due' | 'weak';

export type Route =
  | { name: 'home' }
  | { name: 'course'; courseId: string }
  | { name: 'learn'; courseId: string; chapterId: string; lineIndex: number }
  | { name: 'drill'; mode: DrillMode; courseId?: string; chapterId?: string; lineIndex?: number; study?: boolean }
  | { name: 'quiz'; scope: QuizScope; courseId?: string }
  | { name: 'explore'; courseId: string; chapterId?: string }
  | { name: 'settings' }
  | { name: 'game-review' };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'course': return parts[1] ? { name: 'course', courseId: parts[1] } : { name: 'home' };
    case 'learn': return parts[1] && parts[2] ? { name: 'learn', courseId: parts[1], chapterId: parts[2], lineIndex: parseInt(parts[3] ?? '0', 10) || 0 } : { name: 'home' };
    case 'drill': {
      const modes: DrillMode[] = ['due', 'course', 'chapter', 'line', 'weak', 'all', 'mixed', 'mixed-course', 'mixed-chapter'];
      const mode = (modes.includes(parts[1] as DrillMode) ? parts[1] : 'due') as DrillMode;
      const study = parts[parts.length - 1] === 'study';
      const rest = study ? parts.slice(2, -1) : parts.slice(2);
      return { name: 'drill', mode, courseId: rest[0], chapterId: rest[1], lineIndex: rest[2] !== undefined ? parseInt(rest[2], 10) : undefined, study };
    }
    case 'explore': return parts[1] ? { name: 'explore', courseId: parts[1], chapterId: parts[2] } : { name: 'home' };
    case 'quiz': return { name: 'quiz', scope: (['all', 'course', 'missed', 'due', 'weak'].includes(parts[1]) ? parts[1] : 'all') as QuizScope, courseId: parts[2] };
    case 'settings': return { name: 'settings' };
    case 'game-review': return { name: 'game-review' };
    default: return { name: 'home' };
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const fn = () => { setRoute(parseHash(location.hash)); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  return route;
}

export function navigate(path: string) {
  location.hash = path.startsWith('#') ? path : `#${path}`;
}

export const href = {
  home: () => '#/',
  gameReview: () => '#/game-review',
  course: (id: string) => `#/course/${id}`,
  learn: (courseId: string, chapterId: string, lineIndex = 0) => `#/learn/${courseId}/${chapterId}/${lineIndex}`,
  drillDue: () => '#/drill/due',
  drillWeak: () => '#/drill/weak',
  drillAll: () => '#/drill/all',
  drillCourse: (courseId: string) => `#/drill/course/${courseId}`,
  drillChapter: (courseId: string, chapterId: string) => `#/drill/chapter/${courseId}/${chapterId}`,
  drillLine: (courseId: string, chapterId: string, lineIndex: number, study = false) => `#/drill/line/${courseId}/${chapterId}/${lineIndex}${study ? '/study' : ''}`,
  mixedAll: () => '#/drill/mixed',
  mixedCourse: (courseId: string) => `#/drill/mixed-course/${courseId}`,
  mixedChapter: (courseId: string, chapterId: string) => `#/drill/mixed-chapter/${courseId}/${chapterId}`,
  quiz: (scope: QuizScope, courseId?: string) => `#/quiz/${scope}${courseId ? '/' + courseId : ''}`,
  explore: (courseId: string, chapterId?: string) => `#/explore/${courseId}${chapterId ? '/' + chapterId : ''}`,
  settings: () => '#/settings',
};
