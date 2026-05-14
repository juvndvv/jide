import type { Project } from './project.js';
import type { PersistedSession } from './session.js';
import type { AccentId, DensityId, SidebarSide, ThemeMode } from './theme.js';

export type { ThemeMode };

export interface TabRef {
  worktreeId: string;
  projectId: string;
}

export interface SettingsSchema {
  theme: ThemeMode;
  density: DensityId;
  accent: AccentId;
  sidebarSide: SidebarSide;
  lastWorktreeId: string | null;
  /** Persisted open-tab list (in display order). Empty by default. */
  openTabs: TabRef[];
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
  density: 'comfy',
  accent: 'coral',
  sidebarSide: 'left',
  lastWorktreeId: null,
  openTabs: [],
  projects: [],
  maxSessionsPerWorktree: 4,
  activeSessionByWt: {},
  sessions: {},
};

export type SettingsKey = keyof SettingsSchema;
