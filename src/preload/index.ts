import { contextBridge, ipcRenderer } from 'electron';
import type { JideApi } from '@shared/ipc';
import type { SettingsKey, SettingsSchema } from '@shared/settings';

const api: JideApi = {
  ping: () => ipcRenderer.invoke('ping') as Promise<string>,
  settings: {
    get: <K extends SettingsKey>(key: K): Promise<SettingsSchema[K]> =>
      ipcRenderer.invoke('settings:get', { key }) as Promise<SettingsSchema[K]>,
    set: <K extends SettingsKey>(key: K, value: SettingsSchema[K]): Promise<void> =>
      ipcRenderer.invoke('settings:set', { key, value }) as Promise<void>,
  },
};

contextBridge.exposeInMainWorld('jide', api);
