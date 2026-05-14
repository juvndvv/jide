import { describe, it, expect } from 'vitest';
import type { SessionSnapshot } from '@shared/session';
import { SessionManager } from '../../../../src/main/claude/manager';
import { claudeStateForWorktree } from '../../../../src/main/claude/rollup';

describe('SessionManager -> roll-up integration', () => {
  it('roll-up of an empty worktree is idle', () => {
    const mgr = new SessionManager();
    expect(claudeStateForWorktree(mgr.snapshotsForWorktree('wt-1'))).toBe('idle');
  });

  it('roll-up of a worktree with sessions reflects the joined state', () => {
    const mgr = new SessionManager();
    const a = mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    const aSnap = a.snapshot();
    const synth: SessionSnapshot = { ...aSnap, status: 'streaming' };
    expect(claudeStateForWorktree([synth])).toBe('running');
  });
});
