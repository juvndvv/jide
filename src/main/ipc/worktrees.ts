import { createHandler } from './register.js';
import { createGitClient } from '../git/index.js';
import type { ProjectRegistry } from '../projects/index.js';

export function registerWorktrees(registry: ProjectRegistry): void {
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
    return client.addWorktree({ branch, baseBranch, path });
  });

  createHandler('worktrees:remove', async ({ projectId, worktreePath }) => {
    const client = createGitClient(projectPath(projectId));
    await client.removeWorktree(worktreePath);
  });
}
