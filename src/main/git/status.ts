import { gitExec } from './exec.js';
import type { WorktreeStatus } from '@shared/project';

export interface WorktreeStatusResult {
  status: WorktreeStatus;
  changes: number;
  ahead: number;
  behind: number;
}

export async function worktreeStatus(repoRoot: string): Promise<WorktreeStatusResult> {
  const { stdout: porcelain } = await gitExec(repoRoot, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=normal',
  ]);

  const changes = porcelain.length ? porcelain.split('\0').filter(Boolean).length : 0;

  let ahead = 0;
  let behind = 0;
  try {
    const { stdout } = await gitExec(repoRoot, [
      'rev-list',
      '--left-right',
      '--count',
      'HEAD...@{u}',
    ]);
    const [a, b] = stdout.trim().split(/\s+/);
    ahead = Number.parseInt(a ?? '0', 10);
    behind = Number.parseInt(b ?? '0', 10);
  } catch {
    // No upstream configured — leave ahead/behind at 0.
  }

  return {
    status: changes === 0 ? 'clean' : 'modified',
    changes,
    ahead,
    behind,
  };
}
