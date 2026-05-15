import { subscribe, type AsyncSubscription } from '@parcel/watcher';
import { relative, sep } from 'node:path';
import { realpath } from 'node:fs/promises';
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
}

export interface FileWatcherHandle {
  dispose: () => Promise<void>;
  ready: Promise<void>;
}

// @parcel/watcher's ignore globs prune events at the native layer, avoiding the
// fsevents enumeration that chokidar performed on subscribe. Patterns match the
// segments listed in isIgnoredPath; the JS-level predicate stays as a backstop
// for anything the native matcher misses.
const IGNORE_GLOBS = [
  '**/.git/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/out/**',
  '**/.vite/**',
  '**/.next/**',
  '**/coverage/**',
  '**/.turbo/**',
  '**/target/**',
  '**/build/**',
  '**/.DS_Store',
  '**/Thumbs.db',
];

function mapType(t: 'create' | 'update' | 'delete'): FileChangeKind {
  if (t === 'create') return 'add';
  if (t === 'update') return 'change';
  return 'unlink';
}

export function createFileWatcher(opts: FileWatcherOptions): FileWatcherHandle {
  const debounceMs = opts.debounceMs ?? 200;
  const pending = new Map<string, FileChangeKind>();
  let timer: NodeJS.Timeout | null = null;
  let disposed = false;
  let subscription: AsyncSubscription | null = null;

  const flush = (): void => {
    timer = null;
    if (disposed) return;
    for (const [relPath, kind] of pending) {
      opts.onEvent({ worktreeId: opts.worktreeId, relPath, kind });
    }
    pending.clear();
  };

  const ready = (async () => {
    // On macOS, tmpdir() and several user paths traverse /var → /private/var
    // and /tmp → /private/tmp symlinks. @parcel/watcher emits events with the
    // canonical (post-symlink) path, so we resolve the root first and use it
    // both for subscribe and for the relative() comparison.
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
            console.error('[files/watcher] subscription error', err);
            return;
          }
          if (disposed) return;
          let dirty = false;
          for (const e of events) {
            const rel = toPosix(relative(resolvedRoot, e.path));
            if (rel === '' || rel.startsWith('..')) continue;
            if (isIgnoredPath(rel)) continue;
            pending.set(rel, mapType(e.type));
            dirty = true;
          }
          if (!dirty) return;
          if (timer) clearTimeout(timer);
          timer = setTimeout(flush, debounceMs);
        },
        { ignore: IGNORE_GLOBS },
      );
    } catch (err) {
      console.error('[files/watcher] subscribe failed for', resolvedRoot, err);
    }
  })();

  return {
    ready,
    async dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      if (subscription) {
        await subscription.unsubscribe().catch((err) => {
          console.error('[files/watcher] unsubscribe failed', err);
        });
        subscription = null;
      }
    },
  };
}
