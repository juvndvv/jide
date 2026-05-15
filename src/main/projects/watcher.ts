import { subscribe, type AsyncSubscription } from '@parcel/watcher';
import { realpath } from 'node:fs/promises';
import { relative, sep } from 'node:path';
import { createGitClient } from '../git/index.js';
import { isIgnoredPath } from '../files/ignore.js';
import type { Worktree } from '@shared/project';

function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}

export interface WatcherOptions {
  projectId: string;
  repoRoot: string;
  onChange: (payload: { projectId: string; worktree: Worktree }) => void;
  debounceMs?: number;
}

export interface WatcherHandle {
  dispose: () => Promise<void>;
}

// @parcel/watcher prunes these subtrees at the native layer — events for files
// inside them never reach the JS callback, so a populated node_modules costs
// nothing instead of the 10k-dir enumeration that chokidar performed.
const IGNORE_GLOBS = [
  '**/.git/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/out/**',
  '**/.next/**',
  '**/.vite/**',
  '**/coverage/**',
  '**/.turbo/**',
];

export function createWatcher(opts: WatcherOptions): WatcherHandle {
  const debounceMs = opts.debounceMs ?? 500;
  const client = createGitClient(opts.repoRoot);
  let timer: NodeJS.Timeout | null = null;
  let subscription: AsyncSubscription | null = null;
  let disposed = false;

  const fire = (): void => {
    timer = null;
    if (disposed) return;
    void (async () => {
      try {
        const worktrees = await client.worktrees();
        for (const w of worktrees) {
          opts.onChange({ projectId: opts.projectId, worktree: w });
        }
      } catch (err) {
        console.error('[watcher] status refresh failed', err);
      }
    })();
  };

  void (async () => {
    let resolvedRoot: string;
    try {
      resolvedRoot = await realpath(opts.repoRoot);
    } catch {
      resolvedRoot = opts.repoRoot;
    }
    try {
      subscription = await subscribe(
        resolvedRoot,
        (err, events) => {
          if (err) {
            console.error('[watcher] subscription error', err);
            return;
          }
          if (disposed) return;
          // Filter at the JS level as a backstop in case @parcel/watcher's
          // ignore globs miss something (different platforms have different
          // glob engines).
          const meaningful = events.some((e) => {
            const rel = toPosix(relative(resolvedRoot, e.path));
            if (rel === '' || rel.startsWith('..')) return false;
            return !isIgnoredPath(rel);
          });
          if (!meaningful) return;
          if (timer) clearTimeout(timer);
          timer = setTimeout(fire, debounceMs);
        },
        { ignore: IGNORE_GLOBS },
      );
    } catch (err) {
      console.error('[watcher] subscribe failed for', resolvedRoot, err);
    }
  })();

  return {
    async dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      if (subscription) {
        await subscription.unsubscribe().catch((err) => {
          console.error('[watcher] unsubscribe failed', err);
        });
        subscription = null;
      }
    },
  };
}

export interface WatcherManager {
  reconcile(projects: { id: string; path: string }[]): void;
  disposeAll: () => Promise<void>;
}

export function createWatcherManager(
  onChange: WatcherOptions['onChange'],
  debounceMs?: number,
): WatcherManager {
  const handles = new Map<string, WatcherHandle>();
  return {
    reconcile(projects) {
      const seen = new Set<string>();
      for (const p of projects) {
        seen.add(p.id);
        if (!handles.has(p.id)) {
          handles.set(
            p.id,
            createWatcher({ projectId: p.id, repoRoot: p.path, onChange, debounceMs }),
          );
        }
      }
      for (const id of [...handles.keys()]) {
        if (!seen.has(id)) {
          handles
            .get(id)
            ?.dispose()
            .catch((err: unknown) => {
              console.error('[watcher] dispose failed', err);
            });
          handles.delete(id);
        }
      }
    },
    async disposeAll() {
      for (const h of handles.values()) await h.dispose();
      handles.clear();
    },
  };
}
