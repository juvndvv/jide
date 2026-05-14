import { realpathSync } from 'node:fs';
import type { Worktree } from '@shared/project';
import { listWorktrees, worktreeAdd, worktreeRemove, type WorktreeAddArgs } from './worktree.js';
import { worktreeStatus } from './status.js';
import { listBranches } from './branches.js';

function canonical(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

export interface GitClient {
  worktrees(): Promise<Worktree[]>;
  status(
    worktreePath: string,
  ): Promise<{ status: Worktree['status']; changes: number; ahead: number; behind: number }>;
  branches(): Promise<string[]>;
  addWorktree(args: WorktreeAddArgs): Promise<Worktree>;
  removeWorktree(worktreePath: string): Promise<void>;
}

export function createGitClient(repoRoot: string): GitClient {
  return {
    async worktrees() {
      const raw = await listWorktrees(repoRoot);
      const visible = raw.filter((w) => !w.bare);
      const enriched: Worktree[] = [];
      for (const w of visible) {
        const s = await worktreeStatus(w.path);
        enriched.push({
          id: `${repoRoot}:${w.path}`,
          branch: w.branch ?? '(detached)',
          path: w.path,
          head: (w.head ?? '').slice(0, 7),
          status: s.status,
          claude: 'idle',
          changes: s.changes,
          ahead: s.ahead,
          behind: s.behind,
        });
      }
      return enriched;
    },
    async status(worktreePath) {
      return worktreeStatus(worktreePath);
    },
    branches() {
      return listBranches(repoRoot);
    },
    async addWorktree(args) {
      await worktreeAdd(repoRoot, args);
      const all = await this.worktrees();
      const target = canonical(args.path);
      const found = all.find((w) => canonical(w.path) === target);
      if (!found) throw new Error(`worktree at ${args.path} not found after add`);
      return found;
    },
    async removeWorktree(worktreePath) {
      await worktreeRemove(repoRoot, worktreePath);
    },
  };
}
