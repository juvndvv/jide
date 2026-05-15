import chokidar, { type FSWatcher } from 'chokidar';
import { relative, sep } from 'node:path';
import type { FileChangeEvent, FileChangeKind } from '@shared/files';
import { isIgnoredPath } from './ignore.js';

function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}

export interface FileWatcherOptions {
  worktreeId: string;
  repoRoot: string;
  onEvent: (event: FileChangeEvent) => void;
  debounceMs?: number;
  /** Use polling instead of native FSEvents — more reliable in test environments. */
  usePolling?: boolean;
}

export interface FileWatcherHandle {
  dispose: () => Promise<void>;
  ready: Promise<void>;
}

const EVENT_MAP: Record<string, FileChangeKind> = {
  add: 'add',
  change: 'change',
  unlink: 'unlink',
  addDir: 'add-dir',
  unlinkDir: 'unlink-dir',
};

export function createFileWatcher(opts: FileWatcherOptions): FileWatcherHandle {
  const debounceMs = opts.debounceMs ?? 200;
  const pending = new Map<string, FileChangeKind>();
  let timer: NodeJS.Timeout | null = null;
  let disposed = false;

  const flush = (): void => {
    timer = null;
    if (disposed) return;
    for (const [relPath, kind] of pending) {
      opts.onEvent({ worktreeId: opts.worktreeId, relPath, kind });
    }
    pending.clear();
  };

  const handle = (raw: string) => (abs: string) => {
    const kind = EVENT_MAP[raw];
    if (!kind) return;
    const rel = toPosix(relative(opts.repoRoot, abs));
    if (rel === '' || rel.startsWith('..')) return;
    if (isIgnoredPath(rel)) return;
    pending.set(rel, kind);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };

  const watcher: FSWatcher = chokidar.watch(opts.repoRoot, {
    ignored: (absPath) => {
      const rel = toPosix(relative(opts.repoRoot, absPath));
      return isIgnoredPath(rel);
    },
    ignoreInitial: true,
    persistent: true,
    depth: 10,
    usePolling: opts.usePolling ?? false,
  });

  watcher.on('add', handle('add'));
  watcher.on('change', handle('change'));
  watcher.on('unlink', handle('unlink'));
  watcher.on('addDir', handle('addDir'));
  watcher.on('unlinkDir', handle('unlinkDir'));
  watcher.on('error', (err) => {
    console.error('[files/watcher] error', err);
  });

  const perfLabel = `[perf] files/watcher ${opts.worktreeId} (${opts.repoRoot})`;
  console.time(perfLabel);
  const ready = new Promise<void>((resolve) => {
    watcher.once('ready', () => {
      console.timeEnd(perfLabel);
      const watched = watcher.getWatched();
      let dirCount = 0;
      let fileCount = 0;
      for (const dir of Object.keys(watched)) {
        dirCount++;
        fileCount += watched[dir]?.length ?? 0;
      }
      console.log(
        `[perf] files/watcher ${opts.worktreeId} ready: ${dirCount} dirs, ${fileCount} entries (polling=${opts.usePolling ?? false})`,
      );
      resolve();
    });
  });

  return {
    ready,
    async dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      await watcher.close();
    },
  };
}
