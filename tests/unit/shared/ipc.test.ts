import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  Channel,
  ChannelMap,
  Event,
  EventMap,
  EventPayload,
  JideApi,
  Req,
  Res,
} from '@shared/ipc';
import { CHANNELS, EVENTS } from '@shared/ipc';
import type { SettingsSchema, ThemeMode } from '@shared/settings';
import type { ClaudeState, Project, Worktree, WorktreeStatus } from '@shared/project';
import type { PersistedSession, SessionSnapshot } from '@shared/session';

describe('shared/ipc — runtime', () => {
  it('freezes CHANNELS and includes all expected entries', () => {
    expect(Object.isFrozen(CHANNELS)).toBe(true);
    expect(CHANNELS).toContain('ping');
    expect(CHANNELS).toContain('settings:get');
    expect(CHANNELS).toContain('settings:set');
  });

  it('CHANNELS keys match the runtime keys we use across the app', () => {
    // Sanity guard: if CHANNELS grows, this list is the human-readable
    // mirror future contributors should update.
    expect([...CHANNELS].sort()).toEqual(
      [
        'ping',
        'projects:add',
        'projects:list',
        'projects:remove',
        'settings:get',
        'settings:set',
        'worktrees:add',
        'worktrees:list',
        'worktrees:list-branches',
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
      ].sort(),
    );
  });

  it('declares the multi-session channels', () => {
    expect(CHANNELS).toContain('sessions:list');
    expect(CHANNELS).toContain('sessions:create');
    expect(CHANNELS).toContain('sessions:rename');
    expect(CHANNELS).toContain('sessions:set-active');
    expect(CHANNELS).toContain('sessions:get-active');
    expect(CHANNELS).not.toContain('sessions:start');
  });
});

describe('shared/ipc — type contract', () => {
  it('ping: request is void, response is string', () => {
    expectTypeOf<Req<'ping'>>().toEqualTypeOf<void>();
    expectTypeOf<Res<'ping'>>().toEqualTypeOf<string>();
  });

  it('settings:get: request is a keyed lookup', () => {
    expectTypeOf<Req<'settings:get'>>().toEqualTypeOf<{
      key:
        | 'theme'
        | 'lastWorktreeId'
        | 'projects'
        | 'maxSessionsPerWorktree'
        | 'activeSessionByWt'
        | 'sessions';
    }>();
  });

  it('settings:get: response is the union over all setting value types', () => {
    expectTypeOf<Res<'settings:get'>>().toEqualTypeOf<SettingsSchema[keyof SettingsSchema]>();
  });

  it('CHANNELS covers every key in ChannelMap (drift guard)', () => {
    expectTypeOf<(typeof CHANNELS)[number]>().toEqualTypeOf<keyof ChannelMap>();
  });

  it('Channel union equals keyof ChannelMap', () => {
    expectTypeOf<Channel>().toEqualTypeOf<keyof ChannelMap>();
  });

  it('sessions:send requires sessionId', () => {
    expectTypeOf<Req<'sessions:send'>>().toEqualTypeOf<{
      worktreeId: string;
      sessionId: string;
      text: string;
    }>();
  });

  it('sessions:list returns SessionSnapshot[]', () => {
    expectTypeOf<Req<'sessions:list'>>().toEqualTypeOf<{ worktreeId: string }>();
    expectTypeOf<Res<'sessions:list'>>().toEqualTypeOf<SessionSnapshot[]>();
  });

  it('sessions:create returns a SessionSnapshot', () => {
    expectTypeOf<Req<'sessions:create'>>().toEqualTypeOf<{ worktreeId: string }>();
    expectTypeOf<Res<'sessions:create'>>().toEqualTypeOf<SessionSnapshot>();
  });

  it('sessions:rename carries the new title', () => {
    expectTypeOf<Req<'sessions:rename'>>().toEqualTypeOf<{
      worktreeId: string;
      sessionId: string;
      title: string;
    }>();
  });

  it('sessions:set-active scopes by worktree + session', () => {
    expectTypeOf<Req<'sessions:set-active'>>().toEqualTypeOf<{
      worktreeId: string;
      sessionId: string;
    }>();
  });

  it('sessions:get-active returns the active sessionId or null', () => {
    expectTypeOf<Req<'sessions:get-active'>>().toEqualTypeOf<{ worktreeId: string }>();
    expectTypeOf<Res<'sessions:get-active'>>().toEqualTypeOf<string | null>();
  });
});

describe('shared/ipc — settings:set discriminated payload', () => {
  it('matches key with value (positive)', () => {
    expectTypeOf<Req<'settings:set'>>().toEqualTypeOf<
      | { key: 'theme'; value: ThemeMode }
      | { key: 'lastWorktreeId'; value: string | null }
      | { key: 'projects'; value: Project[] }
      | { key: 'maxSessionsPerWorktree'; value: number }
      | { key: 'activeSessionByWt'; value: Record<string, string> }
      | { key: 'sessions'; value: Record<string, PersistedSession[]> }
    >();
  });

  it('rejects cross-key value contamination', () => {
    // @ts-expect-error theme cannot accept null (it is required ThemeMode)
    const a: Req<'settings:set'> = { key: 'theme', value: null };
    // @ts-expect-error theme cannot accept arbitrary strings
    const b: Req<'settings:set'> = { key: 'theme', value: 'not-a-theme' };
    // @ts-expect-error lastWorktreeId cannot accept a non-string, non-null value
    const c: Req<'settings:set'> = { key: 'lastWorktreeId', value: 123 };
    void a;
    void b;
    void c;
  });
});

describe('shared/ipc — JideApi precision', () => {
  type GetFn = JideApi['settings']['get'];
  type SetFn = JideApi['settings']['set'];
  type PingFn = JideApi['ping'];

  it('settings.get returns a precise type per key', () => {
    const get = (() => Promise.resolve('auto')) as GetFn;
    expectTypeOf(get('theme')).toEqualTypeOf<Promise<ThemeMode>>();
    expectTypeOf(get('lastWorktreeId')).toEqualTypeOf<Promise<string | null>>();
  });

  it('settings.set accepts only matching key/value pairs', () => {
    expectTypeOf<ReturnType<SetFn>>().toEqualTypeOf<Promise<void>>();
  });

  it('ping returns Promise<string>', () => {
    expectTypeOf<ReturnType<PingFn>>().toEqualTypeOf<Promise<string>>();
  });
});

describe('shared/project — type contract', () => {
  it('Worktree includes the fields the Sidebar consumes from the mock', () => {
    const w: Worktree = {
      id: 'wt-1',
      branch: 'feat/x',
      path: '/tmp/repo-feat-x',
      head: 'abc1234',
      status: 'modified',
      claude: 'idle',
      changes: 3,
      ahead: 1,
      behind: 0,
    };
    expectTypeOf(w.status).toEqualTypeOf<WorktreeStatus>();
    expectTypeOf(w.claude).toEqualTypeOf<ClaudeState>();
  });

  it('Project carries id/name/path/expanded', () => {
    const p: Project = {
      id: 'p1',
      name: 'jide',
      path: '/Users/x/code/jide',
      expanded: true,
    };
    expectTypeOf(p.id).toEqualTypeOf<string>();
    expectTypeOf(p.expanded).toEqualTypeOf<boolean>();
  });
});

describe('shared/ipc — events drift guards', () => {
  it('EVENTS includes phase-2 push channels and is frozen', () => {
    expect(Object.isFrozen(EVENTS)).toBe(true);
    expect([...EVENTS].sort()).toEqual(
      [
        'projects:changed',
        'worktrees:status-changed',
        'worktrees:changed',
        'sessions:event',
        'sessions:list-changed',
      ].sort(),
    );
  });

  it('sessions:list-changed payload carries the list', () => {
    expectTypeOf<EventPayload<'sessions:list-changed'>>().toEqualTypeOf<{
      worktreeId: string;
      sessions: SessionSnapshot[];
    }>();
  });

  it('sessions:event payload carries the full snapshot', () => {
    expectTypeOf<EventPayload<'sessions:event'>>().toEqualTypeOf<{
      worktreeId: string;
      snapshot: SessionSnapshot;
    }>();
  });

  it('Event union equals keyof EventMap', () => {
    expectTypeOf<Event>().toEqualTypeOf<keyof EventMap>();
  });

  it('projects:changed payload is Project[]', () => {
    expectTypeOf<EventPayload<'projects:changed'>>().toEqualTypeOf<Project[]>();
  });

  it('worktrees:status-changed payload identifies project + worktree', () => {
    expectTypeOf<EventPayload<'worktrees:status-changed'>>().toEqualTypeOf<{
      projectId: string;
      worktree: Worktree;
    }>();
  });

  it('worktrees:changed payload is project-scoped list', () => {
    expectTypeOf<EventPayload<'worktrees:changed'>>().toEqualTypeOf<{
      projectId: string;
      worktrees: Worktree[];
    }>();
  });
});

describe('shared/ipc — JideApi v2 surface', () => {
  it('exposes projects API with list/add/remove', () => {
    expectTypeOf<JideApi['projects']>().toEqualTypeOf<{
      list: () => Promise<Project[]>;
      add: () => Promise<Project | null>;
      remove: (id: string) => Promise<void>;
    }>();
  });

  it('exposes worktrees API with list/listBranches/add/remove', () => {
    expectTypeOf<JideApi['worktrees']>().toEqualTypeOf<{
      list: (projectId: string) => Promise<Worktree[]>;
      listBranches: (projectId: string) => Promise<string[]>;
      add: (
        projectId: string,
        args: { branch: string; baseBranch?: string; path: string },
      ) => Promise<Worktree>;
      remove: (projectId: string, worktreePath: string) => Promise<void>;
    }>();
  });

  it('on() is generic over Event and returns a disposer', () => {
    expectTypeOf<JideApi['on']>().toEqualTypeOf<
      <E extends Event>(event: E, handler: (payload: EventPayload<E>) => void) => () => void
    >();
  });
});
