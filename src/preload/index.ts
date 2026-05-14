import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { Event, EventPayload, JideApi } from '@shared/ipc';
import { EVENTS } from '@shared/ipc';
import type { SettingsKey, SettingsSchema } from '@shared/settings';
import type { Project, Worktree } from '@shared/project';
import type { SessionSnapshot } from '@shared/session';

const api: JideApi = {
  ping: () => ipcRenderer.invoke('ping') as Promise<string>,
  settings: {
    get: <K extends SettingsKey>(key: K): Promise<SettingsSchema[K]> =>
      ipcRenderer.invoke('settings:get', { key }) as Promise<SettingsSchema[K]>,
    set: <K extends SettingsKey>(key: K, value: SettingsSchema[K]): Promise<void> =>
      ipcRenderer.invoke('settings:set', { key, value }) as Promise<void>,
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list') as Promise<Project[]>,
    add: () => ipcRenderer.invoke('projects:add') as Promise<Project | null>,
    remove: (id) => ipcRenderer.invoke('projects:remove', { id }) as Promise<void>,
  },
  worktrees: {
    list: (projectId) => ipcRenderer.invoke('worktrees:list', { projectId }) as Promise<Worktree[]>,
    listBranches: (projectId) =>
      ipcRenderer.invoke('worktrees:list-branches', { projectId }) as Promise<string[]>,
    add: (projectId, args) =>
      ipcRenderer.invoke('worktrees:add', { projectId, ...args }) as Promise<Worktree>,
    remove: (projectId, worktreePath) =>
      ipcRenderer.invoke('worktrees:remove', { projectId, worktreePath }) as Promise<void>,
  },
  sessions: {
    start: (worktreeId) =>
      ipcRenderer.invoke('sessions:start', { worktreeId }) as Promise<SessionSnapshot>,
    send: (worktreeId, text) =>
      ipcRenderer.invoke('sessions:send', { worktreeId, text }) as Promise<void>,
    kill: (worktreeId) => ipcRenderer.invoke('sessions:kill', { worktreeId }) as Promise<void>,
    approveTool: (worktreeId, toolUseId, allow, reason) =>
      ipcRenderer.invoke('sessions:approve-tool', {
        worktreeId,
        toolUseId,
        allow,
        reason,
      }) as Promise<void>,
    get: (worktreeId) =>
      ipcRenderer.invoke('sessions:get', { worktreeId }) as Promise<SessionSnapshot | null>,
  },
  on: <E extends Event>(event: E, handler: (payload: EventPayload<E>) => void): (() => void) => {
    if (!(EVENTS as readonly string[]).includes(event)) {
      throw new Error(`Unknown event: ${String(event)}`);
    }
    const wrapped = (_e: IpcRendererEvent, payload: EventPayload<E>): void => handler(payload);
    ipcRenderer.on(event, wrapped);
    return () => {
      ipcRenderer.removeListener(event, wrapped);
    };
  },
};

contextBridge.exposeInMainWorld('jide', api);
