import { ipcMain } from 'electron';
import type { PtyManager, PtyDataPayload, PtyExitPayload } from '../pty/manager.js';
import { sendEvent } from './events.js';

export function registerTerminalHandlers(manager: PtyManager | null): void {
  if (manager) {
    manager.on('data', (payload: PtyDataPayload) => sendEvent('terminal:data', payload));
    manager.on('exit', (payload: PtyExitPayload) => sendEvent('terminal:exit', payload));
  }

  ipcMain.handle(
    'terminal:create',
    (_e, req: { worktreeId: string; cwd: string; cols: number; rows: number }) => {
      if (!manager)
        throw new Error('Terminal subsystem unavailable (native bindings failed to load)');
      return manager.create({
        worktreeId: req.worktreeId,
        cwd: req.cwd,
        cols: req.cols,
        rows: req.rows,
      });
    },
  );

  ipcMain.handle('terminal:write', (_e, req: { worktreeId: string; data: string }) => {
    if (!manager) return;
    manager.write(req.worktreeId, req.data);
  });

  ipcMain.handle(
    'terminal:resize',
    (_e, req: { worktreeId: string; cols: number; rows: number }) => {
      if (!manager) return;
      manager.resize(req.worktreeId, req.cols, req.rows);
    },
  );

  ipcMain.handle('terminal:kill', (_e, req: { worktreeId: string }) => {
    if (!manager) return;
    manager.kill(req.worktreeId);
  });
}
