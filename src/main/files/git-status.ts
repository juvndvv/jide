import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitFileStatus } from '@shared/files';

const exec = promisify(execFile);

/**
 * Returns a map relPath (POSIX) → status code. The map is sparse: only files
 * with a non-clean status are included.
 *
 * When a file has different status codes in the index and worktree columns,
 * the badge follows this priority order:
 *   '??' (untracked) > 'M' (modified) > 'A' (added) > 'D' (deleted)
 *     > 'R' (renamed) > 'C' (copied) > 'U' (unmerged)
 */
export async function loadStatus(repoRoot: string): Promise<Map<string, GitFileStatus>> {
  const { stdout } = await exec(
    'git',
    ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
    { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024 },
  );
  return parsePorcelain(stdout);
}

export function parsePorcelain(stdout: string): Map<string, GitFileStatus> {
  const map = new Map<string, GitFileStatus>();
  const buf = stdout;
  let i = 0;
  while (i < buf.length) {
    if (i + 3 > buf.length) break;
    const x = buf.charAt(i);
    const y = buf.charAt(i + 1);
    if (buf.charAt(i + 2) !== ' ') {
      break;
    }
    i += 3;
    const end = buf.indexOf('\0', i);
    if (end === -1) break;
    const path = buf.slice(i, end);
    i = end + 1;
    if (x === 'R' || x === 'C') {
      const oldEnd = buf.indexOf('\0', i);
      if (oldEnd === -1) break;
      i = oldEnd + 1;
    }
    map.set(path, pickStatus(x, y));
  }
  return map;
}

function pickStatus(x: string, y: string): GitFileStatus {
  if (x === '?' && y === '?') return '??';
  if (y === 'M' || x === 'M') return 'M';
  if (y === 'A' || x === 'A') return 'A';
  if (y === 'D' || x === 'D') return 'D';
  if (x === 'R') return 'R';
  if (x === 'C') return 'C';
  if (y === 'U' || x === 'U') return 'U';
  return null;
}
