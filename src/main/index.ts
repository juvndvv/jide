import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window.js';
import { registerAllHandlers } from './ipc/index.js';

void app.whenReady().then(() => {
  registerAllHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
