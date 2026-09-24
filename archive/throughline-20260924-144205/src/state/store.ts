import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { schedule, type Grade, type LineState } from '../lib/srs';

export interface MoveStat {
  attempts: number;
  correct: number;
  lastWrong?: number;
  /** SAN the learner played most recently when wrong. */
  lastWrongSan?: string;
}

export interface SessionDay {
  /** YYYY-MM-DD local */
  day: string;
  lines: number;
  perfect: number;
  mistakes: number;
  userMoves: number;
}

export interface Settings {
  boardTheme: 'walnut' | 'slate' | 'moss' | 'paper';
  sound: boolean;
  showCoordinates: boolean;
  autoAdvanceMs: number;   // pause after a completed line before the next one
  opponentDelayMs: number; // delay before the opponent replies
  showLegalMoves: boolean;
  hintAfterMistakes: number; // arrow hint appears after N wrong tries
  learnGuided: boolean;      // in Learn, you play the moves shown by the arrow (vs click through)
  quizSize: number;          // positions per quick-fire quiz
  mixedSize: number;         // lines per mixed-practice session
  dailyGoal: number;         // lines per day
  showEval: boolean;         // engine eval bar next to the board
  rareCutoff: number;        // stop drilling a line once it is rarer than this (0 = never)
}

export interface ProgressState {
  version: number;
  lines: Record<string, LineState>;
  /** keyed by course/chapter line id → timestamp when first stepped through in Learn */
  learned: Record<string, number>;
  /** keyed by position key */
  moves: Record<string, MoveStat>;
  sessions: SessionDay[];
  settings: Settings;
  lastCourseId?: string;

  recordLineResult: (lineId: string, mistakes: number, hints: number, userMoves: number) => Grade;
  recordMove: (posKey: string, correct: boolean, playedSan?: string) => void;
  markLearned: (lineId: string) => void;
  resetLine: (lineId: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setLastCourse: (id: string) => void;
  resetAll: () => void;
  importState: (json: string) => boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  boardTheme: 'walnut',
  sound: true,
  showCoordinates: true,
  autoAdvanceMs: 1400,
  opponentDelayMs: 450,
  showLegalMoves: true,
  hintAfterMistakes: 1,
  learnGuided: true,
  quizSize: 15,
  mixedSize: 12,
  dailyGoal: 10,
  showEval: true,
  rareCutoff: 0.005,
};

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      version: 1,
      lines: {},
      learned: {},
      moves: {},
      sessions: [],
      settings: DEFAULT_SETTINGS,

      recordLineResult: (lineId, mistakes, hints, userMoves) => {
        const slips = mistakes + hints;
        const grade: Grade = slips === 0 ? 3 : slips === 1 ? 2 : slips <= 3 ? 1 : 0;
        set((s) => {
          const prev = s.lines[lineId];
          const next = schedule(prev, grade);
          const day = todayKey();
          const sessions = [...s.sessions];
          let today = sessions.find((x) => x.day === day);
          if (!today) {
            today = { day, lines: 0, perfect: 0, mistakes: 0, userMoves: 0 };
            sessions.push(today);
          }
          const idx = sessions.indexOf(today);
          sessions[idx] = {
            ...today,
            lines: today.lines + 1,
            perfect: today.perfect + (grade === 3 ? 1 : 0),
            mistakes: today.mistakes + mistakes,
            userMoves: today.userMoves + userMoves,
          };
          return { lines: { ...s.lines, [lineId]: next }, sessions: sessions.slice(-400) };
        });
        return grade;
      },

      recordMove: (key, correct, playedSan) =>
        set((s) => {
          const prev = s.moves[key] ?? { attempts: 0, correct: 0 };
          const next: MoveStat = {
            attempts: prev.attempts + 1,
            correct: prev.correct + (correct ? 1 : 0),
            lastWrong: correct ? prev.lastWrong : Date.now(),
            lastWrongSan: correct ? prev.lastWrongSan : playedSan,
          };
          return { moves: { ...s.moves, [key]: next } };
        }),

      markLearned: (lineId) =>
        set((s) => (s.learned[lineId] ? {} : { learned: { ...s.learned, [lineId]: Date.now() } })),

      resetLine: (lineId) =>
        set((s) => {
          const lines = { ...s.lines };
          delete lines[lineId];
          return { lines };
        }),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setLastCourse: (id) => set({ lastCourseId: id }),

      resetAll: () => set({ lines: {}, learned: {}, moves: {}, sessions: [] }),

      importState: (json) => {
        try {
          const data = JSON.parse(json);
          if (!data || typeof data !== 'object' || !data.lines) return false;
          set({
            lines: data.lines ?? {},
            learned: data.learned ?? {},
            moves: data.moves ?? {},
            sessions: data.sessions ?? [],
            settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
          });
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'throughline.progress',
      partialize: (s) => ({
        version: s.version,
        lines: s.lines,
        learned: s.learned,
        moves: s.moves,
        sessions: s.sessions,
        settings: s.settings,
        lastCourseId: s.lastCourseId,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProgressState>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) } };
      },
    },
  ),
);

export function exportState(): string {
  const s = useProgress.getState();
  return JSON.stringify(
    { version: s.version, exportedAt: new Date().toISOString(), lines: s.lines, learned: s.learned, moves: s.moves, sessions: s.sessions, settings: s.settings },
    null,
    2,
  );
}
