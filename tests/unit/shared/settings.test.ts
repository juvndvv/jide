import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type SettingsKey } from '@shared/settings';

describe('shared/settings — schema contract', () => {
  it('default settings include theme tweaks fields', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('auto');
    expect(DEFAULT_SETTINGS.density).toBe('comfy');
    expect(DEFAULT_SETTINGS.accent).toBe('coral');
    expect(DEFAULT_SETTINGS.sidebarSide).toBe('left');
    expect(DEFAULT_SETTINGS.openTabs).toEqual([]);
  });

  it('SettingsKey covers the new fields', () => {
    // new keys must be assignable to SettingsKey
    const density: SettingsKey = 'density';
    const accent: SettingsKey = 'accent';
    const sidebarSide: SettingsKey = 'sidebarSide';
    const openTabs: SettingsKey = 'openTabs';
    void density;
    void accent;
    void sidebarSide;
    void openTabs;
  });

  it('default settings preserve legacy fields', () => {
    expect(DEFAULT_SETTINGS.lastWorktreeId).toBeNull();
    expect(DEFAULT_SETTINGS.projects).toEqual([]);
    expect(DEFAULT_SETTINGS.maxSessionsPerWorktree).toBe(4);
    expect(DEFAULT_SETTINGS.activeSessionByWt).toEqual({});
    expect(DEFAULT_SETTINGS.sessions).toEqual({});
  });

  it('default settings include layoutByWt', () => {
    expect(DEFAULT_SETTINGS.layoutByWt).toEqual({});
  });

  it('SettingsKey covers layoutByWt', () => {
    const layoutByWt: SettingsKey = 'layoutByWt';
    void layoutByWt;
  });
});
