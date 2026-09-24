export interface CourseCard {
  id: string;
  title: string;
  url: string;
  side: "White" | "Black";
  description: string;
  image: string;
  chapters: number;
  studies: number;
  variations: number;
  positions: number;
}
export interface CourseLine {
  id: string;
  title: string;
  sans: string[];
}
export interface Note {
  text: string;
  arrows?: { threats: string[]; opportunities: string[] } | null;
  highlights?: { threats: string[]; opportunities: string[] } | null;
}
export interface PathTile {
  id: string;
  kind: "learn" | "review" | "graduate" | "video";
  index: number;
  required: boolean;
  newVariations: string[];
  reviewVariations: string[];
  videoIds: string[];
  quizIds: string[];
  verified: boolean;
}
export interface Lesson {
  id: string;
  title: string;
  chapterId: string;
  chapter: string;
  lines: CourseLine[];
  notes: Record<string, Note[]>;
  tiles: PathTile[];
}
export interface Course extends CourseCard {
  lessons: Lesson[];
}
export interface Progress {
  saved: string[];
  tiles?: Record<string, string>;
  completed: Record<string, string>;
  reviews: { course: string; line: string; at: string; mistakes: number }[];
  last: { course: string; study: string; line: number; ply?: number } | null;
}
export const EMPTY: Progress = {
  saved: [],
  completed: {},
  reviews: [],
  last: null,
};
export const storageKey = "chess-library-progress-v1";
export function readProgress(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || "null");
    return validProgress(raw) ? raw : EMPTY;
  } catch {
    return EMPTY;
  }
}
export function validProgress(raw: unknown): raw is Progress {
  if (!raw || typeof raw !== "object") return false;
  const p = raw as Progress;
  return (
    (p.tiles === undefined || (!!p.tiles && typeof p.tiles === "object" && !Array.isArray(p.tiles) &&
      Object.values(p.tiles).every(x => typeof x === "string" && !isNaN(Date.parse(x))))) &&
    Array.isArray(p.saved) &&
    p.saved.every((x) => typeof x === "string") &&
    !!p.completed &&
    typeof p.completed === "object" &&
    !Array.isArray(p.completed) &&
    Object.values(p.completed).every(
      (x) => typeof x === "string" && !isNaN(Date.parse(x)),
    ) &&
    Array.isArray(p.reviews) &&
    p.reviews.every(
      (r) =>
        r &&
        typeof r.course === "string" &&
        typeof r.line === "string" &&
        typeof r.at === "string" &&
        !isNaN(Date.parse(r.at)) &&
        Number.isFinite(r.mistakes),
    ) &&
    (p.last === null ||
      (!!p.last &&
        typeof p.last.course === "string" &&
        typeof p.last.study === "string" &&
        Number.isInteger(p.last.line) &&
        p.last.line >= 0 &&
        (p.last.ply === undefined ||
          (Number.isInteger(p.last.ply) && p.last.ply >= 0))))
  );
}
const cache = new Map<string, Promise<Course>>();
function libraryUrl(id: string, refresh = false) {
  const suffix = refresh ? "&refresh=1" : "";
  return `${import.meta.env.BASE_URL}library/${encodeURIComponent(id)}.json?schema=2${suffix}`;
}
export function loadCourse(id: string): Promise<Course> {
  const wasCached = cache.has(id);
  if (!wasCached) {
    cache.set(
      id,
      fetch(libraryUrl(id), { cache: "no-cache" })
        .then((r) => {
          if (!r.ok) throw Error("This course could not be loaded.");
          return r.json();
        })
        .then(async (course: Course) => {
          if (!course.lessons?.every(s => Array.isArray(s.tiles))) {
            const fresh = await fetch(libraryUrl(id, true), { cache: "reload" });
            if (!fresh.ok) throw Error("This course could not be loaded.");
            course = await fresh.json();
          }
          if (!course.lessons?.every(s => Array.isArray(s.tiles))) throw Error("Course data is updating. Please reload this page in a moment.");
          return course;
        })
        .catch((e) => {
          cache.delete(id);
          throw e;
        }),
    );
  }
  return cache.get(id)!.then(course => {
    if (!course.lessons.every(s => Array.isArray(s.tiles)) || (wasCached && course.lessons.some(s => s.tiles.some(t => !t.verified)))) {
      cache.delete(id);
      return loadCourse(id);
    }
    return course;
  });
}
export function lineKey(course: string, line: string) {
  return `${course}/${line}`;
}
export function completion(course: CourseCard, p: Progress) {
  return Object.keys(p.completed).filter((k) => k.startsWith(course.id + "/"))
    .length;
}
export function percent(course: CourseCard, p: Progress) {
  return Math.min(
    100,
    Math.round((completion(course, p) / course.variations) * 100),
  );
}
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Replace imported placeholder names with the actual moves for line selectors. */
export function lineDisplayTitle(line: CourseLine): string {
  if (!/^\s*\**variation\s+\d+(?:\s+of\s+\d+)?\**\s*$/i.test(line.title)) return line.title;
  return line.sans.map((san, i) => `${i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ''}${san}`).join(' ');
}
