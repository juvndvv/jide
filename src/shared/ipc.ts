import type { SettingsKey, SettingsSchema } from './settings.js';
import type { Project, Worktree } from './project.js';
import type { SessionSnapshot } from './session.js';
import type { FileNode, FileReadResult, FileChangeEvent, FileStatusChangeEvent } from './files.js';

export const CHANNELS = [
  'ping',
  'settings:get',
  'settings:set',
  'projects:list',
  'projects:add',
  'projects:remove',
  'worktrees:list',
  'worktrees:list-branches',
  'worktrees:add',
  'worktrees:remove',
  'sessions:list',
  'sessions:create',
  'sessions:send',
  'sessions:kill',
  'sessions:get',
  'sessions:approve-tool',
  'sessions:rename',
  'sessions:set-active',
  'sessions:get-active',
  'terminal:create',
  'terminal:write',
  'terminal:resize',
  'terminal:kill',
  'files:tree',
  'files:read',
  'files:open-in-viewer',
  'files:search',
] as const;
export type Channel = (typeof CHANNELS)[number];

export type ChannelMap = {
  ping: { req: void; res: string };
  'settings:get': {
    req: { key: SettingsKey };
    res: SettingsSchema[SettingsKey];
  };
  'settings:set': {
    req: { [K in SettingsKey]: { key: K; value: SettingsSchema[K] } }[SettingsKey];
    res: void;
  };
  'projects:list': { req: void; res: Project[] };
  'projects:add': { req: void; res: Project | null };
  'projects:remove': { req: { id: string }; res: void };
  'worktrees:list': { req: { projectId: string }; res: Worktree[] };
  'worktrees:list-branches': { req: { projectId: string }; res: string[] };
  'worktrees:add': {
    req: { projectId: string; branch: string; baseBranch?: string; path: string };
    res: Worktree;
  };
  'worktrees:remove': { req: { projectId: string; worktreePath: string }; res: void };
  'sessions:list': { req: { worktreeId: string }; res: SessionSnapshot[] };
  'sessions:create': { req: { worktreeId: string }; res: SessionSnapshot };
  'sessions:send': { req: { worktreeId: string; sessionId: string; text: string }; res: void };
  'sessions:kill': { req: { worktreeId: string; sessionId: string }; res: void };
  'sessions:get': { req: { worktreeId: string; sessionId: string }; res: SessionSnapshot | null };
  'sessions:approve-tool': {
    req: {
      worktreeId: string;
      sessionId: string;
      toolUseId: string;
      allow: boolean;
      reason?: string;
    };
    res: void;
  };
  'sessions:rename': { req: { worktreeId: string; sessionId: string; title: string }; res: void };
  'sessions:set-active': { req: { worktreeId: string; sessionId: string }; res: void };
  'sessions:get-active': { req: { worktreeId: string }; res: string | null };
  'terminal:create': { req: { worktreeId: string; cwd: string; cols: number; rows: number }; res: { pid: number } };
  'terminal:write': { req: { worktreeId: string; data: string }; res: void };
  'terminal:resize': { req: { worktreeId: string; cols: number; rows: number }; res: void };
  'terminal:kill': { req: { worktreeId: string }; res: void };
  'files:tree': {
    req: { worktreeId: string; relPath: string | null };
    res: FileNode[];
  };
  'files:read': {
    req: { worktreeId: string; relPath: string };
    res: FileReadResult;
  };
  'files:open-in-viewer': {
    req: { worktreeId: string; pathFromTool: string };
    res: { relPath: string } | null;
  };
  'files:search': {
    req: { worktreeId: string; query: string; limit: number };
    res: { relPath: string; name: string }[];
  };
};

export type Req<C extends Channel> = ChannelMap[C]['req'];
export type Res<C extends Channel> = ChannelMap[C]['res'];

export const EVENTS = [
  'projects:changed',
  'worktrees:status-changed',
  'worktrees:changed',
  'sessions:event',
  'sessions:list-changed',
  'terminal:data',
  'terminal:exit',
  'files:change',
  'files:status-changed',
] as const;
export type Event = (typeof EVENTS)[number];

export type EventMap = {
  'projects:changed': Project[];
  'worktrees:status-changed': { projectId: string; worktree: Worktree };
  'worktrees:changed': { projectId: string; worktrees: Worktree[] };
  'sessions:event': { worktreeId: string; snapshot: SessionSnapshot };
  'sessions:list-changed': { worktreeId: string; sessions: SessionSnapshot[] };
  'terminal:data': { worktreeId: string; data: string };
  /** signal uses string | null for renderer-bundle compatibility (no node types in web tsconfig). */
  'terminal:exit': { worktreeId: string; code: number | null; signal: string | null };
  'files:change': FileChangeEvent;
  'files:status-changed': FileStatusChangeEvent;
};

export type EventPayload<E extends Event> = EventMap[E];

export interface JideApi {
  ping: () => Promise<string>;
  settings: {
    get: <K extends SettingsKey>(key: K) => Promise<SettingsSchema[K]>;
    set: <K extends SettingsKey>(key: K, value: SettingsSchema[K]) => Promise<void>;
  };
  projects: {
    list: () => Promise<Project[]>;
    add: () => Promise<Project | null>;
    remove: (id: string) => Promise<void>;
  };
  worktrees: {
    list: (projectId: string) => Promise<Worktree[]>;
    listBranches: (projectId: string) => Promise<string[]>;
    add: (
      projectId: string,
      args: { branch: string; baseBranch?: string; path: string },
    ) => Promise<Worktree>;
    remove: (projectId: string, worktreePath: string) => Promise<void>;
  };
  sessions: {
    list: (worktreeId: string) => Promise<SessionSnapshot[]>;
    create: (worktreeId: string) => Promise<SessionSnapshot>;
    send: (worktreeId: string, sessionId: string, text: string) => Promise<void>;
    kill: (worktreeId: string, sessionId: string) => Promise<void>;
    get: (worktreeId: string, sessionId: string) => Promise<SessionSnapshot | null>;
    approveTool: (
      worktreeId: string,
      sessionId: string,
      toolUseId: string,
      allow: boolean,
      reason?: string,
    ) => Promise<void>;
    rename: (worktreeId: string, sessionId: string, title: string) => Promise<void>;
    setActive: (worktreeId: string, sessionId: string) => Promise<void>;
    getActive: (worktreeId: string) => Promise<string | null>;
  };
  terminal: {
    create: (worktreeId: string, cwd: string, cols?: number, rows?: number) => Promise<{ pid: number }>;
    write: (worktreeId: string, data: string) => Promise<void>;
    resize: (worktreeId: string, cols: number, rows: number) => Promise<void>;
    kill: (worktreeId: string) => Promise<void>;
  };
  files: {
    tree: (worktreeId: string, relPath: string | null) => Promise<FileNode[]>;
    read: (worktreeId: string, relPath: string) => Promise<FileReadResult>;
    openInViewer: (
      worktreeId: string,
      pathFromTool: string,
    ) => Promise<{ relPath: string } | null>;
    search: (
      worktreeId: string,
      query: string,
      limit: number,
    ) => Promise<{ relPath: string; name: string }[]>;
  };
  on: <E extends Event>(event: E, handler: (payload: EventPayload<E>) => void) => () => void;
}

declare global {
  interface Window {
    jide: JideApi;
  }
}

Object.freeze(CHANNELS);
Object.freeze(EVENTS);
