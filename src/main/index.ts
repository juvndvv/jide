import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window.js';
import { registerAllHandlers } from './ipc/index.js';
import { createStore } from './store/index.js';
import { createProjectRegistry } from './projects/index.js';
import { createWatcherManager } from './projects/watcher.js';
import { sendEvent } from './ipc/events.js';

void app.whenReady().then(() => {
  const store = createStore({ cwd: process.env.JIDE_TEST_STORE_CWD });
  const registry = createProjectRegistry(store);

  const manager = createWatcherManager(({ projectId, worktree }) => {
    sendEvent('worktrees:status-changed', { projectId, worktree });
  });

  const reconcile = (): void => {
    manager.reconcile(registry.list().map((p) => ({ id: p.id, path: p.path })));
  };

  registerAllHandlers({ store, registry, afterProjectsMutation: reconcile });

  reconcile();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
