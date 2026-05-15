import { readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { FileNode } from '@shared/files';
import { isIgnoredPath } from './ignore.js';

function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}

/**
 * List immediate children of `absDirPath` inside the worktree rooted at
 * `repoRoot`. Filters via `isIgnoredPath`. Sort: dirs first (alphabetical),
 * then files (alphabetical). Case-insensitive comparison.
 */
export async function readChildren(absDirPath: string, repoRoot: string): Promise<FileNode[]> {
  const entries = await readdir(absDirPath, { withFileTypes: true });
  const out: FileNode[] = [];
  for (const entry of entries) {
    const abs = join(absDirPath, entry.name);
    const rel = toPosix(relative(repoRoot, abs));
    if (isIgnoredPath(rel)) continue;
    if (entry.isDirectory()) {
      out.push({ name: entry.name, relPath: rel, kind: 'dir', sizeBytes: null });
      continue;
    }
    if (entry.isFile() || entry.isSymbolicLink()) {
      let sizeBytes: number | null = null;
      try {
        const s = await stat(abs);
        sizeBytes = s.size;
      } catch {
        sizeBytes = null;
      }
      out.push({ name: entry.name, relPath: rel, kind: 'file', sizeBytes });
    }
  }
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return out;
}
