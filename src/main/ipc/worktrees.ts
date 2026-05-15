import { createHandler } from './register.js';
import { sendEvent } from './events.js';
import { createGitClient } from '../git/index.js';
import type { ProjectRegistry } from '../projects/index.js';

export interface WorktreesDeps {
  onWorktreeRemoved?: (worktreeId: string) => void;
}

export function registerWorktrees(registry: ProjectRegistry, deps: WorktreesDeps = {}): void {
  function projectPath(projectId: string): string {
    const p = registry.list().find((x) => x.id === projectId);
    if (!p) throw new Error(`Project not found: ${projectId}`);
    return p.path;
  }

  createHandler('worktrees:list', async ({ projectId }) => {
    const client = createGitClient(projectPath(projectId));
    return client.worktrees();
  });

  createHandler('worktrees:list-branches', async ({ projectId }) => {
    const client = createGitClient(projectPath(projectId));
    return client.branches();
  });

  createHandler('worktrees:add', async ({ projectId, branch, baseBranch, path }) => {
    const client = createGitClient(projectPath(projectId));
    const newWorktree = await client.addWorktree({ branch, baseBranch, path });
    sendEvent('worktrees:changed', { projectId, worktrees: await client.worktrees() });
    return newWorktree;
  });

  createHandler('worktrees:remove', async ({ projectId, worktreePath }) => {
    const client = createGitClient(projectPath(projectId));
    await client.removeWorktree(worktreePath);
    sendEvent('worktrees:changed', { projectId, worktrees: await client.worktrees() });
    deps.onWorktreeRemoved?.(`${projectPath(projectId)}:${worktreePath}`);
  });
}
