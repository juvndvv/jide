import chokidar, { type FSWatcher } from 'chokidar';
import { createGitClient } from '../git/index.js';
import type { Worktree } from '@shared/project';

export interface WatcherOptions {
  projectId: string;
  repoRoot: string;
  onChange: (payload: { projectId: string; worktree: Worktree }) => void;
  debounceMs?: number;
}

export interface WatcherHandle {
  dispose: () => Promise<void>;
}

// chokidar opens one fd per watched directory (fs.watch). A project with a
// populated node_modules tree easily exceeds macOS' default ulimit of 256
// and surfaces as EMFILE. The function predicate prevents descent into
// heavy / irrelevant subtrees BEFORE the fd is opened; depth caps recursion
// to a sane limit so a freak deep tree can't blow past it anyway.
const isIgnored = (p: string): boolean =>
  /(^|\/)\.git(\/|$)/.test(p) ||
  /(^|\/)node_modules(\/|$)/.test(p) ||
  /(^|\/)dist(\/|$)/.test(p) ||
  /(^|\/)out(\/|$)/.test(p) ||
  /(^|\/)\.next(\/|$)/.test(p) ||
  /(^|\/)\.vite(\/|$)/.test(p) ||
  /(^|\/)coverage(\/|$)/.test(p) ||
  /(^|\/)\.turbo(\/|$)/.test(p);

export function createWatcher(opts: WatcherOptions): WatcherHandle {
  const debounceMs = opts.debounceMs ?? 500;
  const client = createGitClient(opts.repoRoot);
  let timer: NodeJS.Timeout | null = null;
  let active: FSWatcher | null = null;
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

  const startWatcher = (usePolling: boolean): FSWatcher => {
    const w = chokidar.watch(opts.repoRoot, {
      ignored: isIgnored,
      ignoreInitial: true,
      persistent: true,
      depth: 10,
      usePolling,
      // Polling at 1s is a reasonable trade-off when EMFILE forces this path:
      // a developer waits ~1s for the status badge, no fd cost.
      interval: usePolling ? 1000 : undefined,
    });
    w.on('all', () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fire, debounceMs);
    });
    w.on('error', (err) => {
      const code = (err as NodeJS.ErrnoException).code;
      if ((code === 'EMFILE' || code === 'ENOSPC') && !usePolling) {
        // Fall back to polling — no fd cost, mild CPU cost.
        console.warn(
          `[watcher] ${opts.repoRoot}: ${code} from fs.watch. Falling back to polling watcher.`,
        );
        void w.close().finally(() => {
          if (disposed) return;
          active = startWatcher(true);
        });
        return;
      }
      console.error('[watcher] error', err);
    });
    return w;
  };

  active = startWatcher(false);

  return {
    async dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      if (active) await active.close();
      active = null;
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
