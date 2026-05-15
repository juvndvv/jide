import { gitExec } from '../git/exec.js';
import type { GitFileStatus } from '@shared/files';

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
  const perfLabel = `[perf] git-status loadStatus (${repoRoot})`;
  console.time(perfLabel);
  const { stdout } = await gitExec(repoRoot, [
    'status', '--porcelain=v1', '-z', '--untracked-files=all',
  ]);
  const map = parsePorcelain(stdout);
  console.timeEnd(perfLabel);
  console.log(
    `[perf] git-status loadStatus parsed ${map.size} entries (${stdout.length} stdout bytes)`,
  );
  return map;
}

export function parsePorcelain(stdout: string): Map<string, GitFileStatus> {
  const map = new Map<string, GitFileStatus>();
  let i = 0;
  while (i < stdout.length) {
    if (i + 3 > stdout.length) break;
    const x = stdout.charAt(i);
    const y = stdout.charAt(i + 1);
    // Defensive abort on unrecognized record header: porcelain v1 has no sync
    // token, so resuming mid-stream after a malformed entry is unreliable.
    if (stdout.charAt(i + 2) !== ' ') {
      break;
    }
    i += 3;
    const end = stdout.indexOf('\0', i);
    if (end === -1) break;
    const path = stdout.slice(i, end);
    i = end + 1;
    if (x === 'R' || x === 'C') {
      const oldEnd = stdout.indexOf('\0', i);
      if (oldEnd === -1) break;
      i = oldEnd + 1;
    }
    const status = pickStatus(x, y);
    if (status !== null) {
      map.set(path, status);
    }
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
