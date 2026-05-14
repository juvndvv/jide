import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SessionManager } from '../../../../src/main/claude/manager';
import { setClaudeBinaryForTests } from '../../../../src/main/claude/locator';
import { fakeClaudeArgs } from '../../helpers/fake-claude-runner';

const __filename = fileURLToPath(import.meta.url);
const here = dirname(__filename);
const SIMPLE = resolve(here, '../../../fixtures/claude-events/simple.script.json');

describe('SessionManager', () => {
  beforeEach(() => setClaudeBinaryForTests('node'));
  afterEach(() => setClaudeBinaryForTests(null));

  it('returns the same session for repeated startForWorktree (Phase 3 cap)', () => {
    const mgr = new SessionManager();
    const a = mgr.startForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    const b = mgr.startForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    expect(a).toBe(b);
  });

  it('different worktrees get independent sessions', () => {
    const mgr = new SessionManager();
    const a = mgr.startForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    const b = mgr.startForWorktree({ worktreeId: 'wt-2', cwd: '/tmp' });
    expect(a).not.toBe(b);
    expect(mgr.activeWorktrees().sort()).toEqual(['wt-1', 'wt-2']);
  });

  it('snapshotForWorktree mirrors the underlying session', () => {
    const mgr = new SessionManager();
    const session = mgr.startForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    expect(mgr.snapshotForWorktree('wt-1')).toBe(session.snapshot());
    expect(mgr.snapshotForWorktree('wt-missing')).toBeNull();
  });

  it('re-emits snapshot events from underlying sessions', async () => {
    const mgr = new SessionManager();
    const seen: number[] = [];
    mgr.on('snapshot', () => seen.push(Date.now()));
    const session = mgr.startForWorktree({
      worktreeId: 'wt-1',
      cwd: '/tmp',
      argsBuilder: () => fakeClaudeArgs(SIMPLE),
    });
    const exited = new Promise<void>((r) => session.on('exit', () => r()));
    session.start();
    await exited;
    expect(seen.length).toBeGreaterThan(0);
  });

  it('after natural exit, the Map cleans up via the exit listener', async () => {
    const mgr = new SessionManager();
    const session = mgr.startForWorktree({
      worktreeId: 'wt-1',
      cwd: '/tmp',
      argsBuilder: () => fakeClaudeArgs(SIMPLE),
    });
    const exited = new Promise<void>((r) => session.on('exit', () => r()));
    session.start();
    await exited;
    // Allow the listener to run.
    await new Promise((r) => setImmediate(r));
    expect(mgr.activeWorktrees()).not.toContain('wt-1');
  });

  it('killAll kills every active session', async () => {
    const mgr = new SessionManager();
    const a = mgr.startForWorktree({
      worktreeId: 'wt-1',
      cwd: '/tmp',
      argsBuilder: () => fakeClaudeArgs(SIMPLE),
    });
    const b = mgr.startForWorktree({
      worktreeId: 'wt-2',
      cwd: '/tmp',
      argsBuilder: () => fakeClaudeArgs(SIMPLE),
    });
    const aExited = new Promise<void>((r) => a.on('exit', () => r()));
    const bExited = new Promise<void>((r) => b.on('exit', () => r()));
    a.start();
    b.start();
    mgr.killAll();
    await Promise.all([aExited, bExited]);
    // Wait for Map cleanup.
    await new Promise((r) => setImmediate(r));
    expect(mgr.activeWorktrees()).toEqual([]);
  });
});
