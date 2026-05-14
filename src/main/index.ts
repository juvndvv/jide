import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window.js';
import { registerAllHandlers } from './ipc/index.js';
import { createStore } from './store/index.js';
import { createProjectRegistry } from './projects/index.js';
import { createWatcherManager } from './projects/watcher.js';
import { sendEvent } from './ipc/events.js';
import { SessionManager } from './claude/manager.js';

let manager: SessionManager | null = null;

void app.whenReady().then(() => {
  const store = createStore({ cwd: process.env.JIDE_TEST_STORE_CWD });
  const registry = createProjectRegistry(store);
  manager = new SessionManager();

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
});

app.on('before-quit', () => {
  // Kill any active claude subprocesses so they don't outlive Electron.
  manager?.killAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
