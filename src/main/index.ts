import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window.js';
import { registerAllHandlers } from './ipc/index.js';
import { createStore, type JideStore } from './store/index.js';
import { createProjectRegistry } from './projects/index.js';
import { createWatcherManager } from './projects/watcher.js';
import { sendEvent } from './ipc/events.js';
import { SessionManager } from './claude/manager.js';
import { loadAllSessions, saveSessionsForWorktree } from './claude/persistence.js';

// Safety net: anything that escapes a .catch() lands here with a full stack.
// In dev this surfaces the offending call site; in production it keeps the
// process alive instead of crashing on a single failed IPC round-trip.
process.on('unhandledRejection', (reason, promise) => {
  console.error('[jide] unhandledRejection:', reason);
  console.error('[jide] promise:', promise);
});

let store: JideStore | null = null;
let manager: SessionManager | null = null;

app
  .whenReady()
  .then(() => {
    store = createStore({ cwd: process.env.JIDE_TEST_STORE_CWD });
    const registry = createProjectRegistry(store);
    manager = new SessionManager({
      maxSessionsPerWorktree: store.get('maxSessionsPerWorktree') ?? 4,
    });

    const persisted = loadAllSessions(store);
    for (const [worktreeId, sessions] of Object.entries(persisted)) {
      for (const seed of sessions) {
        manager.rehydrate({ worktreeId, cwd: seed.cwd, seed });
      }
    }

    const watcherMgr = createWatcherManager(({ projectId, worktree }) => {
      sendEvent('worktrees:status-changed', { projectId, worktree });
    });

    const reconcile = (): void => {
      watcherMgr.reconcile(registry.list().map((p) => ({ id: p.id, path: p.path })));
    };

    registerAllHandlers({
      store,
      registry,
      manager,
      afterProjectsMutation: reconcile,
    });

    reconcile();
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  })
  .catch((err: unknown) => {
    console.error('[jide] boot failed', err);
    app.quit();
  });

app.on('before-quit', () => {
  if (manager && store) {
    const wts = manager.activeWorktrees();
    for (const wt of wts) {
      const snaps = manager.snapshotsForWorktree(wt);
      const toPersist = snaps.filter((s) => s.messages.length > 0);
      saveSessionsForWorktree(store, wt, toPersist);
    }
    manager.killAll();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
