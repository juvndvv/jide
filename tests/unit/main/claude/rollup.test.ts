import { describe, it, expect } from 'vitest';
import type { SessionSnapshot, SessionStatus } from '@shared/session';
import { claudeStateForWorktree } from '../../../../src/main/claude/rollup';

function snap(status: SessionStatus): SessionSnapshot {
  return {
    id: { worktreeId: 'wt', uuid: status },
    status,
    model: 'sonnet',
    cwd: '/tmp',
    title: 't',
    createdAt: 0,
    messages: [],
    rateLimit: null,
    awaitingToolUseId: null,
    totalCostUsd: 0,
  };
}

describe('claudeStateForWorktree', () => {
  it('returns idle for an empty list', () => {
    expect(claudeStateForWorktree([])).toBe('idle');
  });

  it('returns idle when all sessions are idle/exited', () => {
    expect(claudeStateForWorktree([snap('idle'), snap('exited')])).toBe('idle');
  });

  it('prioritises running over awaiting/error/idle', () => {
    expect(claudeStateForWorktree([snap('idle'), snap('streaming'), snap('error')])).toBe(
      'running',
    );
    expect(claudeStateForWorktree([snap('awaiting'), snap('requesting')])).toBe('running');
    expect(claudeStateForWorktree([snap('starting'), snap('error')])).toBe('running');
  });

  it('prioritises awaiting over error/idle when no session is running', () => {
    expect(claudeStateForWorktree([snap('awaiting'), snap('error'), snap('idle')])).toBe(
      'awaiting',
    );
  });

  it('prioritises error over idle when no session is running or awaiting', () => {
    expect(claudeStateForWorktree([snap('error'), snap('idle'), snap('exited')])).toBe('error');
  });
});
