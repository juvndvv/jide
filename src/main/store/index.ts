import Store from 'electron-store';
import { DEFAULT_SETTINGS, type SettingsKey, type SettingsSchema } from '@shared/settings';

export interface CreateStoreOptions {
  cwd?: string;
  name?: string;
}

export interface JideStore {
  get: <K extends SettingsKey>(key: K) => SettingsSchema[K];
  set: <K extends SettingsKey>(key: K, value: SettingsSchema[K]) => void;
}

export function createStore(options: CreateStoreOptions = {}): JideStore {
  const inner = new Store<SettingsSchema>({
    name: options.name ?? 'settings',
    cwd: options.cwd,
    defaults: DEFAULT_SETTINGS,
  });

  return {
    get: (key) => inner.get(key),
    set: (key, value) => inner.set(key, value),
  };
}
