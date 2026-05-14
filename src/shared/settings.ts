export type ThemeMode = 'light' | 'dark' | 'auto';

export interface SettingsSchema {
  theme: ThemeMode;
  lastWorktreeId: string | null;
}

export const DEFAULT_SETTINGS: SettingsSchema = {
  theme: 'auto',
  lastWorktreeId: null,
};

export type SettingsKey = keyof SettingsSchema;
