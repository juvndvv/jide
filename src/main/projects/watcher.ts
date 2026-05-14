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

export function createWatcher(opts: WatcherOptions): WatcherHandle {
  const debounceMs = opts.debounceMs ?? 500;
  const client = createGitClient(opts.repoRoot);
  let timer: NodeJS.Timeout | null = null;

  const watcher: FSWatcher = chokidar.watch(opts.repoRoot, {
    ignored: (path) =>
      /\/\.git(\/|$)/.test(path) ||
      /\/node_modules(\/|$)/.test(path) ||
      /\/dist(\/|$)/.test(path) ||
      /\/out(\/|$)/.test(path),
    ignoreInitial: true,
    persistent: true,
  });

  const fire = (): void => {
    timer = null;
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

  watcher.on('all', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fire, debounceMs);
  });

  return {
    async dispose() {
      if (timer) clearTimeout(timer);
      await watcher.close();
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
          void handles.get(id)?.dispose();
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
