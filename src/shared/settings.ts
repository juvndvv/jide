import type { Project } from './project.js';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface SettingsSchema {
  theme: ThemeMode;
  lastWorktreeId: string | null;
  projects: Project[];
}

export const DEFAULT_SETTINGS: SettingsSchema = {
  theme: 'auto',
  lastWorktreeId: null,
  projects: [],
};

export type SettingsKey = keyof SettingsSchema;
