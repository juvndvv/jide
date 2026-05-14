import type { Project } from './project.js';
import type { PersistedSession } from './session.js';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface SettingsSchema {
  theme: ThemeMode;
  lastWorktreeId: string | null;
  projects: Project[];
  /** 1..16. Default 4. */
  maxSessionsPerWorktree: number;
  /** worktreeId → sessionUuid. Selects which session focuses when the worktree is opened. */
  activeSessionByWt: Record<string, string>;
  /** worktreeId → list of persisted session snapshots. */
  sessions: Record<string, PersistedSession[]>;
}

export const DEFAULT_SETTINGS: SettingsSchema = {
  theme: 'auto',
  lastWorktreeId: null,
  projects: [],
  maxSessionsPerWorktree: 4,
  activeSessionByWt: {},
  sessions: {},
};

export type SettingsKey = keyof SettingsSchema;
