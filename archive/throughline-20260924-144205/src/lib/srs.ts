/**
 * Spaced repetition for repertoire lines — a simplified SM-2.
 * A "card" is a whole line (one path from the start to a leaf). The learner drills the
 * line, we count mistakes and hints, and the result becomes a grade 0–3.
 */
export interface LineState {
  reps: number;        // consecutive successful reviews
  ease: number;        // multiplier, 1.3 – 3.0
  interval: number;    // days until the next review (0 = same session)
  due: number;         // epoch ms
  lapses: number;      // number of failed reviews
  lastSeen: number;    // epoch ms
  lastGrade: Grade;
  history: Grade[];    // most recent last, capped
}

/** 3 perfect · 2 one slip · 1 shaky · 0 failed */
export type Grade = 0 | 1 | 2 | 3;

export type Mastery = 'new' | 'learning' | 'familiar' | 'mastered';

const DAY = 86_400_000;
const MIN = 60_000;

export function gradeFromDrill(mistakes: number, hints: number): Grade {
  const slips = mistakes + hints;
  if (slips === 0) return 3;
  if (slips === 1) return 2;
  if (slips <= 3) return 1;
  return 0;
}

export function schedule(prev: LineState | undefined, grade: Grade, now = Date.now()): LineState {
  const ease = prev?.ease ?? 2.5;
  const reps = prev?.reps ?? 0;
  const interval = prev?.interval ?? 0;
  const lapses = prev?.lapses ?? 0;
  const history = [...(prev?.history ?? []), grade].slice(-20);

  let next: LineState;
  if (grade >= 2) {
    let newInterval: number;
    if (reps === 0) newInterval = 1;
    else if (reps === 1) newInterval = 3;
    else newInterval = Math.round(interval * ease);
    if (grade === 2) newInterval = Math.max(1, Math.round(newInterval * 0.6));
    const newEase = clamp(ease + (grade === 3 ? 0.1 : -0.05), 1.3, 3.0);
    next = {
      reps: reps + 1,
      ease: newEase,
      interval: newInterval,
      due: now + newInterval * DAY,
      lapses,
      lastSeen: now,
      lastGrade: grade,
      history,
    };
  } else {
    // Failed: come back within the session, and again tomorrow.
    next = {
      reps: 0,
      ease: clamp(ease - (grade === 0 ? 0.2 : 0.15), 1.3, 3.0),
      interval: 0,
      due: now + 10 * MIN,
      lapses: lapses + 1,
      lastSeen: now,
      lastGrade: grade,
      history,
    };
  }
  return next;
}

export function masteryOf(state: LineState | undefined): Mastery {
  if (!state || state.reps === 0) return state?.lastSeen ? 'learning' : 'new';
  if (state.interval < 4) return 'learning';
  if (state.interval < 21) return 'familiar';
  return 'mastered';
}

export function isDue(state: LineState | undefined, now = Date.now()): boolean {
  return !!state && state.due <= now;
}

/** Whole days from now until due; negative when overdue. */
export function daysUntilDue(state: LineState, now = Date.now()): number {
  return Math.ceil((state.due - now) / DAY);
}

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}
