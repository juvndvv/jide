import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClaudeSession } from '../../../../src/main/claude/session';
import { setClaudeBinaryForTests } from '../../../../src/main/claude/locator';
import { fakeClaudeArgs } from '../../helpers/fake-claude-runner';
import type { SessionSnapshot } from '@shared/session';

const __filename = fileURLToPath(import.meta.url);
const here = dirname(__filename);

const SIMPLE = resolve(here, '../../../fixtures/claude-events/simple.script.json');
const FOLLOWUP = resolve(here, '../../../fixtures/claude-events/with-stdin-followup.script.json');

describe('ClaudeSession (with fake-claude)', () => {
  beforeEach(() => setClaudeBinaryForTests('node'));
  afterEach(() => setClaudeBinaryForTests(null));

  it('emits snapshots as fake-claude emits events; exits cleanly', async () => {
    const snaps: SessionSnapshot[] = [];
    const session = new ClaudeSession({
      worktreeId: 'wt-1',
      cwd: '/tmp',
      model: 'haiku',
      argsBuilder: () => fakeClaudeArgs(SIMPLE),
    });
    session.on('snapshot', (s: SessionSnapshot) => snaps.push(s));
    const exited = new Promise<number | null>((r) => session.on('exit', r));
    session.start();
    const code = await exited;

    expect(code).toBe(0);
    expect(snaps.length).toBeGreaterThan(2);
    const last = snaps[snaps.length - 1]!;
    expect(last.status).toBe('exited');
    expect(last.messages.some((m) => m.type === 'claude' && !m.thinking)).toBe(true);
  });

  it('send() pushes a user Message and writes a {type:user} line on stdin', async () => {
    const snaps: SessionSnapshot[] = [];
    const session = new ClaudeSession({
      worktreeId: 'wt-1',
      cwd: '/tmp',
      model: 'haiku',
      argsBuilder: () => fakeClaudeArgs(FOLLOWUP),
    });
    session.on('snapshot', (s: SessionSnapshot) => snaps.push(s));
    const exited = new Promise<number | null>((r) => session.on('exit', r));
    session.start();
    // Wait briefly so fake-claude reaches its echo-stdin step.
    await new Promise((r) => setTimeout(r, 200));
    session.send('follow-up text');
    const code = await exited;

    expect(code).toBe(0);
    const userMsgs = snaps[snaps.length - 1]!.messages.filter((m) => m.type === 'user');
    expect(userMsgs).toHaveLength(1);
    const first = userMsgs[0];
    if (first && first.type === 'user') {
      expect(first.text).toBe('follow-up text');
    }
  });

  it('kill() terminates the process and emits an exit event', async () => {
    const session = new ClaudeSession({
      worktreeId: 'wt-1',
      cwd: '/tmp',
      // The followup script blocks on echo-stdin after the first turn — perfect for kill().
      argsBuilder: () => fakeClaudeArgs(FOLLOWUP),
    });
    const exited = new Promise<number | null>((r) => session.on('exit', r));
    session.start();
    await new Promise((r) => setTimeout(r, 100));
    session.kill();
    const code = await exited;
    // SIGTERM normally surfaces as code === null on Node child_process; accept either form.
    expect(code === null || code !== 0).toBe(true);
  });

  it('start() is idempotent', async () => {
    const session = new ClaudeSession({
      worktreeId: 'wt-1',
      cwd: '/tmp',
      argsBuilder: () => fakeClaudeArgs(SIMPLE),
    });
    const exited = new Promise<number | null>((r) => session.on('exit', r));
    session.start();
    session.start();
    const code = await exited;
    expect(code).toBe(0);
  });

  it('send() after natural exit emits an error snapshot, does not respawn', async () => {
    const session = new ClaudeSession({
      worktreeId: 'wt-1',
      cwd: '/tmp',
      argsBuilder: () => fakeClaudeArgs(SIMPLE),
    });
    const exited = new Promise<number | null>((r) => session.on('exit', r));
    session.start();
    await exited;
    const snapsAfter: SessionSnapshot[] = [];
    session.on('snapshot', (s) => snapsAfter.push(s as SessionSnapshot));
    session.send('this should not respawn');
    expect(snapsAfter).toHaveLength(1);
    const last = snapsAfter[0]!;
    expect(last.status).toBe('error');
    expect(last.messages.some((m) => m.type === 'system' && m.level === 'error')).toBe(true);
  });

  it('start() after natural exit resets terminated and spawns again', async () => {
    const session = new ClaudeSession({
      worktreeId: 'wt-1',
      cwd: '/tmp',
      argsBuilder: () => fakeClaudeArgs(SIMPLE),
    });
    const firstExit = new Promise<number | null>((r) => session.once('exit', r));
    session.start();
    await firstExit;
    const secondExit = new Promise<number | null>((r) => session.once('exit', r));
    session.start();
    const code = await secondExit;
    expect(code).toBe(0);
  });

  it('spawn error surfaces a system error snapshot', async () => {
    setClaudeBinaryForTests('/nonexistent/path/to/claude-binary-xyz');
    try {
      const session = new ClaudeSession({ worktreeId: 'wt-1', cwd: '/tmp' });
      const snaps: SessionSnapshot[] = [];
      session.on('snapshot', (s) => snaps.push(s as SessionSnapshot));
      session.start();
      await new Promise((r) => setTimeout(r, 300));
      const errSnap = snaps.find((s) =>
        s.messages.some((m) => m.type === 'system' && m.level === 'error'),
      );
      expect(errSnap).toBeDefined();
    } finally {
      setClaudeBinaryForTests('node');
    }
  });
});
