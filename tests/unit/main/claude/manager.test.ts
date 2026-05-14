import { describe, it, expect } from 'vitest';
import { SessionManager, SessionCapReachedError } from '../../../../src/main/claude/manager';

describe('SessionManager', () => {
  it('clamps the cap to [1,16] and defaults to 4', () => {
    expect(new SessionManager().getMaxPerWorktree()).toBe(4);
    expect(new SessionManager({ maxSessionsPerWorktree: 0 }).getMaxPerWorktree()).toBe(1);
    expect(new SessionManager({ maxSessionsPerWorktree: 100 }).getMaxPerWorktree()).toBe(16);
  });

  it('createForWorktree creates a new session every call up to the cap', () => {
    const mgr = new SessionManager({ maxSessionsPerWorktree: 2 });
    const a = mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    const b = mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    expect(a).not.toBe(b);
    expect(mgr.listForWorktree('wt-1')).toHaveLength(2);
  });

  it('throws SessionCapReachedError when over the cap', () => {
    const mgr = new SessionManager({ maxSessionsPerWorktree: 1 });
    mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    expect(() => mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' }))
      .toThrowError(SessionCapReachedError);
  });

  it('getById finds the session by uuid', () => {
    const mgr = new SessionManager();
    const s = mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    const uuid = s.snapshot().id.uuid;
    expect(mgr.getById('wt-1', uuid)).toBe(s);
    expect(mgr.getById('wt-1', 'missing')).toBeNull();
  });

  it('emits list-changed when a session is created', () => {
    const mgr = new SessionManager();
    const events: number[] = [];
    mgr.on('list-changed', (payload: { sessions: unknown[] }) => events.push(payload.sessions.length));
    mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    expect(events).toEqual([1, 2]);
  });

  it('rehydrate bypasses the cap so history is never lost', () => {
    const mgr = new SessionManager({ maxSessionsPerWorktree: 1 });
    mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    const seed = {
      id: { worktreeId: 'wt-1', uuid: 'seed' },
      status: 'idle' as const,
      model: 'sonnet',
      cwd: '/tmp',
      title: 't',
      createdAt: 0,
      messages: [],
      rateLimit: null,
      awaitingToolUseId: null,
      totalCostUsd: 0,
    };
    expect(() =>
      mgr.rehydrate({ worktreeId: 'wt-1', cwd: '/tmp', seed }),
    ).not.toThrow();
    expect(mgr.listForWorktree('wt-1')).toHaveLength(2);
  });
});
