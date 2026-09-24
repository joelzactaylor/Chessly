import { isDue, masteryOf, type LineState, type Mastery } from '../lib/srs';
import type { Line } from '../lib/types';
import type { MoveStat, SessionDay } from './store';
import { todayKey } from './store';

export function countMastery(lines: Line[], states: Record<string, LineState>): Record<Mastery, number> {
  const out: Record<Mastery, number> = { new: 0, learning: 0, familiar: 0, mastered: 0 };
  for (const l of lines) out[masteryOf(states[l.id])]++;
  return out;
}

export function dueLines(lines: Line[], states: Record<string, LineState>, now = Date.now()): Line[] {
  return lines.filter((l) => isDue(states[l.id], now)).sort((a, b) => states[a.id].due - states[b.id].due);
}
export function countDueLines(lines: Line[], states: Record<string, LineState>, now = Date.now()): number {
  let count = 0;
  for (const line of lines) if (isDue(states[line.id], now)) count++;
  return count;
}

/** Lines that contain a position the learner has got wrong recently or often. */
export function weakLines(lines: Line[], moves: Record<string, MoveStat>): Array<{ line: Line; score: number }> {
  const out: Array<{ line: Line; score: number }> = [];
  for (const l of lines) {
    let score = 0;
    for (const n of l.nodes) {
      if (!n.userMove) continue;
      const st = moves[n.parent!.key];
      if (!st || st.attempts < 1) continue;
      const wrongRate = 1 - st.correct / st.attempts;
      const recent = st.lastWrong && Date.now() - st.lastWrong < 7 * 86_400_000 ? 0.5 : 0;
      score += wrongRate + recent;
    }
    if (score > 0.4) out.push({ line: l, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Position keys the learner keeps getting wrong: at least two attempts and under 75% right, or wrong on the last try. */
export function weakPositions(moves: Record<string, MoveStat>): string[] {
  return Object.entries(moves)
    .filter(([, st]) => st.attempts >= 2 && (st.correct / st.attempts < 0.75 || (st.lastWrong !== undefined && st.lastWrongSan !== undefined && st.correct < st.attempts && Date.now() - st.lastWrong < 3 * 86_400_000)))
    .sort((a, b) => a[1].correct / a[1].attempts - b[1].correct / b[1].attempts)
    .map(([k]) => k);
}

export function streakDays(sessions: SessionDay[]): number {
  const days = new Set(sessions.filter((s) => s.lines > 0).map((s) => s.day));
  let streak = 0;
  const d = new Date();
  // Today counts if trained; otherwise start from yesterday.
  if (!days.has(todayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(todayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

export function totals(sessions: SessionDay[]): { lines: number; perfect: number; userMoves: number; mistakes: number } {
  return sessions.reduce((a, s) => ({ lines: a.lines + s.lines, perfect: a.perfect + s.perfect, userMoves: a.userMoves + s.userMoves, mistakes: a.mistakes + s.mistakes }), { lines: 0, perfect: 0, userMoves: 0, mistakes: 0 });
}

export function todayStats(sessions: SessionDay[]): SessionDay {
  return sessions.find((s) => s.day === todayKey()) ?? { day: todayKey(), lines: 0, perfect: 0, mistakes: 0, userMoves: 0 };
}

/** Next review date across a set of lines, or null. */
export function nextDue(lines: Line[], states: Record<string, LineState>): number | null {
  let min: number | null = null;
  for (const l of lines) {
    const s = states[l.id];
    if (!s) continue;
    if (min === null || s.due < min) min = s.due;
  }
  return min;
}
