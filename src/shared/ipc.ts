import type { SettingsKey, SettingsSchema } from './settings.js';
import type { Project, Worktree } from './project.js';
import type { SessionSnapshot } from './session.js';

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
  'sessions:start',
  'sessions:send',
  'sessions:kill',
  'sessions:approve-tool',
  'sessions:get',
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
  'sessions:start': { req: { worktreeId: string }; res: SessionSnapshot };
  'sessions:send': { req: { worktreeId: string; text: string }; res: void };
  'sessions:kill': { req: { worktreeId: string }; res: void };
  'sessions:approve-tool': {
    req: { worktreeId: string; toolUseId: string; allow: boolean; reason?: string };
    res: void;
  };
  'sessions:get': { req: { worktreeId: string }; res: SessionSnapshot | null };
};

export type Req<C extends Channel> = ChannelMap[C]['req'];
export type Res<C extends Channel> = ChannelMap[C]['res'];

export const EVENTS = [
  'projects:changed',
  'worktrees:status-changed',
  'worktrees:changed',
  'sessions:event',
] as const;
export type Event = (typeof EVENTS)[number];

export type EventMap = {
  'projects:changed': Project[];
  'worktrees:status-changed': { projectId: string; worktree: Worktree };
  'worktrees:changed': { projectId: string; worktrees: Worktree[] };
  'sessions:event': { worktreeId: string; snapshot: SessionSnapshot };
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
    start: (worktreeId: string) => Promise<SessionSnapshot>;
    send: (worktreeId: string, text: string) => Promise<void>;
    kill: (worktreeId: string) => Promise<void>;
    approveTool: (
      worktreeId: string,
      toolUseId: string,
      allow: boolean,
      reason?: string,
    ) => Promise<void>;
    get: (worktreeId: string) => Promise<SessionSnapshot | null>;
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
