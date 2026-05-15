import { ipcMain } from 'electron';
import { isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { realpath } from 'node:fs/promises';
import { readChildren } from '../files/tree.js';
import { readFile } from '../files/reader.js';
import { loadStatus } from '../files/git-status.js';
import { createFileWatcher, type FileWatcherHandle } from '../files/watcher.js';
import { sendEvent } from './events.js';
import type { FileChangeEvent, GitFileStatus } from '@shared/files';

function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}

interface WorktreeContext {
  worktreeId: string;
  worktreePath: string;
}

/**
 * Resolves `input` against `root`, returning `{ abs, rel }` when the result
 * is strictly inside `root`, or `null` for any traversal escape attempt.
 * Follows symlinks via `fs.realpath` and re-verifies the real path is inside
 * the worktree root, preventing symlink-based traversal bypasses.
 * `rel` uses POSIX separators and is never empty (root itself → null).
 */
export async function resolveWithinRoot(
  root: string,
  input: string,
): Promise<{ abs: string; rel: string } | null> {
  const rootR = resolve(root);
  const inputResolved = isAbsolute(input) ? normalize(input) : resolve(join(rootR, input));
  if (inputResolved !== rootR && !inputResolved.startsWith(rootR + sep)) return null;
  // realpath follows symlinks. If the target file doesn't exist (which is fine for
  // open-in-viewer when the file may not yet exist), fall through to use the
  // string-resolved path — it's still inside the root.
  let real: string;
  try {
    real = await realpath(inputResolved);
  } catch {
    real = inputResolved;
  }
  const realRoot = await realpath(rootR).catch(() => rootR);
  if (real !== realRoot && !real.startsWith(realRoot + sep)) return null;
  const rel = toPosix(relative(realRoot, real));
  if (rel === '') return null;
  return { abs: real, rel };
}

export interface FileWatcherManager {
  ensure: (ctx: WorktreeContext) => void;
  release: (worktreeId: string) => void;
  disposeAll: () => Promise<void>;
}

export function registerFilesHandlers(
  getWorktreeRoot: (worktreeId: string) => string | null,
): FileWatcherManager {
  const handles = new Map<string, FileWatcherHandle>();
  const statusCache = new Map<string, Map<string, GitFileStatus>>();
  const statusTimers = new Map<string, NodeJS.Timeout>();

  const scheduleStatusRefresh = (worktreeId: string, worktreePath: string): void => {
    const existing = statusTimers.get(worktreeId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      if (!handles.has(worktreeId)) return;
      statusTimers.delete(worktreeId);
      void (async () => {
        try {
          const map = await loadStatus(worktreePath);
          const prev = statusCache.get(worktreeId) ?? new Map<string, GitFileStatus>();
          const changes: Record<string, GitFileStatus> = {};
          for (const [p, s] of map) if (prev.get(p) !== s) changes[p] = s;
          for (const [p] of prev) if (!map.has(p)) changes[p] = null;
          statusCache.set(worktreeId, map);
          if (Object.keys(changes).length > 0) {
            sendEvent('files:status-changed', { worktreeId, changes });
          }
        } catch (err) {
          console.error('[files/ipc] status refresh failed', err);
        }
      })();
    }, 300);
    statusTimers.set(worktreeId, t);
  };

  const onChange = (event: FileChangeEvent): void => {
    sendEvent('files:change', event);
    const root = getWorktreeRoot(event.worktreeId);
    if (root) scheduleStatusRefresh(event.worktreeId, root);
  };

  const ensureWatcher = (worktreeId: string, worktreePath: string): void => {
    if (handles.has(worktreeId)) return;
    console.log(`[perf] ipc/files ensureWatcher first-call for ${worktreeId}`);
    const handle = createFileWatcher({ worktreeId, repoRoot: worktreePath, onEvent: onChange });
    handles.set(worktreeId, handle);
    void loadStatus(worktreePath)
      .then((m) => statusCache.set(worktreeId, m))
      .catch((err) => console.error('[files/ipc] initial status load failed', err));
  };

  ipcMain.handle('files:tree', async (_, req: { worktreeId: string; relPath: string | null }) => {
    const perfLabel = `[perf] ipc/files files:tree (${req.worktreeId} :: ${req.relPath ?? '<root>'})`;
    console.time(perfLabel);
    try {
      const root = getWorktreeRoot(req.worktreeId);
      if (!root) return [];
      ensureWatcher(req.worktreeId, root);
      if (req.relPath === null) {
        return await readChildren(resolve(root), resolve(root));
      }
      const resolved = await resolveWithinRoot(root, req.relPath);
      if (!resolved) return [];
      return await readChildren(resolved.abs, resolve(root));
    } finally {
      console.timeEnd(perfLabel);
    }
  });

  ipcMain.handle('files:read', async (_, req: { worktreeId: string; relPath: string }) => {
    const root = getWorktreeRoot(req.worktreeId);
    if (!root) return { kind: 'missing' };
    const resolved = await resolveWithinRoot(root, req.relPath);
    if (!resolved) return { kind: 'missing' };
    return await readFile(resolved.abs);
  });

  ipcMain.handle(
    'files:open-in-viewer',
    async (_, req: { worktreeId: string; pathFromTool: string }) => {
      const root = getWorktreeRoot(req.worktreeId);
      if (!root) return null;
      const resolved = await resolveWithinRoot(root, req.pathFromTool);
      if (!resolved) return null;
      return { relPath: resolved.rel };
    },
  );

  return {
    ensure({ worktreeId, worktreePath }) {
      ensureWatcher(worktreeId, worktreePath);
    },
    release(worktreeId) {
      const h = handles.get(worktreeId);
      if (!h) return;
      handles.delete(worktreeId);
      statusCache.delete(worktreeId);
      const t = statusTimers.get(worktreeId);
      if (t) {
        clearTimeout(t);
        statusTimers.delete(worktreeId);
      }
      h.dispose().catch((err) => console.error('[files/ipc] dispose failed', err));
    },
    async disposeAll() {
      for (const t of statusTimers.values()) clearTimeout(t);
      statusTimers.clear();
      const arr = [...handles.values()];
      handles.clear();
      statusCache.clear();
      await Promise.all(arr.map((h) => h.dispose().catch(() => undefined)));
    },
  };
}
