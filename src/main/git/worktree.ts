import { gitExec } from './exec.js';

export interface RawWorktreeEntry {
  path: string;
  head: string | null;
  branch: string | null;
  detached: boolean;
  bare: boolean;
  locked: boolean;
}

export function parseWorktreeList(stdout: string): RawWorktreeEntry[] {
  const blocks = stdout
    .split(/\r?\n\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const lines = block.split(/\r?\n/);
    const entry: RawWorktreeEntry = {
      path: '',
      head: null,
      branch: null,
      detached: false,
      bare: false,
      locked: false,
    };
    for (const line of lines) {
      if (line.startsWith('worktree ')) entry.path = line.slice('worktree '.length);
      else if (line.startsWith('HEAD ')) entry.head = line.slice('HEAD '.length);
      else if (line.startsWith('branch ')) {
        entry.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
      } else if (line === 'detached') entry.detached = true;
      else if (line === 'bare') entry.bare = true;
      else if (line.startsWith('locked')) entry.locked = true;
    }
    return entry;
  });
}

export async function listWorktrees(repoRoot: string): Promise<RawWorktreeEntry[]> {
  const { stdout } = await gitExec(repoRoot, ['worktree', 'list', '--porcelain']);
  return parseWorktreeList(stdout);
}
