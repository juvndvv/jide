import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window.js';
import { registerAllHandlers } from './ipc/index.js';
import { createStore } from './store/index.js';
import { createProjectRegistry } from './projects/index.js';

void app.whenReady().then(() => {
  const store = createStore({ cwd: process.env.JIDE_TEST_STORE_CWD });
  const registry = createProjectRegistry(store);
  registerAllHandlers({ store, registry });
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
