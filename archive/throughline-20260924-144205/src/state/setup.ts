import { create } from 'zustand';

export type SetupPhase = 'idle' | 'running' | 'pausing' | 'paused' | 'error' | 'complete';
export interface CourseBuildView { id: string; processed: number; pending: number; finished: number; complete: boolean }
export interface SetupState {
  phase: SetupPhase;
  message: string;
  error?: string;
  courseId?: string;
  fen?: string;
  path?: string;
  courses: CourseBuildView[];
}

export const useSetup = create<SetupState>(() => ({ phase: 'idle', message: 'Ready when you are.', courses: [] }));
