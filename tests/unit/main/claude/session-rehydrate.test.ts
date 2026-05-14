import { describe, it, expect } from 'vitest';
import { ClaudeSession } from '../../../../src/main/claude/session';
import type { PersistedSession } from '@shared/session';

const SEED: PersistedSession = {
  id: { worktreeId: 'wt-1', uuid: 'seed-uuid' },
  status: 'idle',
  model: 'sonnet',
  cwd: '/tmp',
  title: 'Rehydrated session',
  createdAt: 1_700_000_000_000,
  messages: [
    { type: 'user', id: 'u-0', text: 'previous turn', ts: 0 },
    { type: 'claude', id: 'c-0', text: 'previous reply', ts: 1 },
  ],
  rateLimit: null,
  awaitingToolUseId: null,
  totalCostUsd: 0.0123,
};

describe('ClaudeSession (rehydrated)', () => {
  it('returns the seeded snapshot before any send', () => {
    const s = new ClaudeSession({ worktreeId: 'wt-1', cwd: '/tmp', seed: SEED });
    const snap = s.snapshot();
    expect(snap.id.uuid).toBe('seed-uuid');
    expect(snap.title).toBe('Rehydrated session');
    expect(snap.messages).toHaveLength(2);
    expect(snap.totalCostUsd).toBeCloseTo(0.0123);
  });

  it('preserves the session uuid across rehydrate (does NOT mint a new one on start)', () => {
    const s = new ClaudeSession({
      worktreeId: 'wt-1',
      cwd: '/tmp',
      seed: SEED,
      argsBuilder: () => ['--script', 'noop'],
    });
    expect(s.snapshot().id.uuid).toBe('seed-uuid');
  });
});

describe('ClaudeSession.rename', () => {
  it('updates the title and emits a snapshot', () => {
    const s = new ClaudeSession({ worktreeId: 'wt-1', cwd: '/tmp' });
    let observed = '';
    s.on('snapshot', (snap) => {
      observed = snap.title;
    });
    s.rename('  My new title  ');
    expect(s.snapshot().title).toBe('My new title');
    expect(observed).toBe('My new title');
  });
});
