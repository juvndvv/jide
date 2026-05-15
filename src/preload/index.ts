import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { Event, EventPayload, JideApi } from '@shared/ipc';
import { EVENTS } from '@shared/ipc';
import type { SettingsKey, SettingsSchema } from '@shared/settings';
import type { Project, Worktree } from '@shared/project';
import type { SessionSnapshot } from '@shared/session';
import type { FileNode, FileReadResult } from '@shared/files';

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
    list: (worktreeId) =>
      ipcRenderer.invoke('sessions:list', { worktreeId }) as Promise<SessionSnapshot[]>,
    create: (worktreeId) =>
      ipcRenderer.invoke('sessions:create', { worktreeId }) as Promise<SessionSnapshot>,
    send: (worktreeId, sessionId, text) =>
      ipcRenderer.invoke('sessions:send', { worktreeId, sessionId, text }) as Promise<void>,
    kill: (worktreeId, sessionId) =>
      ipcRenderer.invoke('sessions:kill', { worktreeId, sessionId }) as Promise<void>,
    get: (worktreeId, sessionId) =>
      ipcRenderer.invoke('sessions:get', {
        worktreeId,
        sessionId,
      }) as Promise<SessionSnapshot | null>,
    approveTool: (worktreeId, sessionId, toolUseId, allow, reason) =>
      ipcRenderer.invoke('sessions:approve-tool', {
        worktreeId,
        sessionId,
        toolUseId,
        allow,
        reason,
      }) as Promise<void>,
    rename: (worktreeId, sessionId, title) =>
      ipcRenderer.invoke('sessions:rename', { worktreeId, sessionId, title }) as Promise<void>,
    setActive: (worktreeId, sessionId) =>
      ipcRenderer.invoke('sessions:set-active', { worktreeId, sessionId }) as Promise<void>,
    getActive: (worktreeId) =>
      ipcRenderer.invoke('sessions:get-active', { worktreeId }) as Promise<string | null>,
  },
  terminal: {
    create: (worktreeId, cwd, cols = 80, rows = 24) =>
      ipcRenderer.invoke('terminal:create', { worktreeId, cwd, cols, rows }) as Promise<{ pid: number }>,
    write: (worktreeId, data) =>
      ipcRenderer.invoke('terminal:write', { worktreeId, data }) as Promise<void>,
    resize: (worktreeId, cols, rows) =>
      ipcRenderer.invoke('terminal:resize', { worktreeId, cols, rows }) as Promise<void>,
    kill: (worktreeId) =>
      ipcRenderer.invoke('terminal:kill', { worktreeId }) as Promise<void>,
  },
  files: {
    tree: (worktreeId, relPath) =>
      ipcRenderer.invoke('files:tree', { worktreeId, relPath }) as Promise<FileNode[]>,
    read: (worktreeId, relPath) =>
      ipcRenderer.invoke('files:read', { worktreeId, relPath }) as Promise<FileReadResult>,
    openInViewer: (worktreeId, pathFromTool) =>
      ipcRenderer.invoke('files:open-in-viewer', {
        worktreeId,
        pathFromTool,
      }) as Promise<{ relPath: string } | null>,
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
