import type { ClaudeState } from '@shared/project';
import type { SessionSnapshot, SessionStatus } from '@shared/session';

const RUNNING: ReadonlySet<SessionStatus> = new Set(['starting', 'requesting', 'streaming']);

/**
 * Phase 4 roll-up rule: running > awaiting > error > idle.
 * Where "running" covers starting/requesting/streaming — anything where
 * the user should see a pulsing dot. `exited` is treated as idle.
 */
export function claudeStateForWorktree(snapshots: readonly SessionSnapshot[]): ClaudeState {
  let hasAwaiting = false;
  let hasError = false;
  for (const s of snapshots) {
    if (RUNNING.has(s.status)) return 'running';
    if (s.status === 'awaiting') hasAwaiting = true;
    else if (s.status === 'error') hasError = true;
  }
  if (hasAwaiting) return 'awaiting';
  if (hasError) return 'error';
  return 'idle';
}
