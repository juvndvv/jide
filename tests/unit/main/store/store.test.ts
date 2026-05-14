import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createStore } from '../../../../src/main/store/index';
import { DEFAULT_SETTINGS } from '@shared/settings';
import { tmpStoreDir } from '../../helpers/tmp-store';

describe('createStore', () => {
  let cwd: string;
  let cleanup: () => void;

  beforeEach(() => {
    ({ cwd, cleanup } = tmpStoreDir());
  });
  afterEach(() => cleanup());

  it('returns the default value when a key is unset', () => {
    const store = createStore({ cwd });
    expect(store.get('theme')).toBe(DEFAULT_SETTINGS.theme);
  });

  it('persists a written value across instances', () => {
    const a = createStore({ cwd });
    a.set('theme', 'dark');
    const b = createStore({ cwd });
    expect(b.get('theme')).toBe('dark');
  });

  it('persists null for lastWorktreeId by default', () => {
    const store = createStore({ cwd });
    expect(store.get('lastWorktreeId')).toBeNull();
    store.set('lastWorktreeId', 'wt-1');
    expect(store.get('lastWorktreeId')).toBe('wt-1');
  });
});
