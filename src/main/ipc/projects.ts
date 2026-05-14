import { BrowserWindow, dialog } from 'electron';
import { createHandler } from './register.js';
import { sendEvent } from './events.js';
import type { ProjectRegistry } from '../projects/index.js';

export function registerProjects(registry: ProjectRegistry, afterMutation: () => void): void {
  createHandler('projects:list', () => Promise.resolve(registry.list()));

  createHandler('projects:add', async () => {
    // JIDE_TEST_DIALOG_RETURN bypasses the native dialog for E2E tests.
    // undefined = run the real dialog; '' = simulate cancellation; any other
    // string = treat it as the chosen path. Production code never sets it.
    const testPath = process.env.JIDE_TEST_DIALOG_RETURN;
    let chosen: string | undefined;
    if (testPath !== undefined) {
      chosen = testPath || undefined;
    } else {
      const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
      const result = await (focusedWindow
        ? dialog.showOpenDialog(focusedWindow, {
            title: 'Add project',
            properties: ['openDirectory', 'createDirectory'],
          })
        : dialog.showOpenDialog({
            title: 'Add project',
            properties: ['openDirectory', 'createDirectory'],
          }));
      if (result.canceled || !result.filePaths[0]) return null;
      chosen = result.filePaths[0];
    }

    if (!chosen) return null;
    const project = await registry.add(chosen);
    sendEvent('projects:changed', registry.list());
    afterMutation();
    return project;
  });

  createHandler('projects:remove', ({ id }) => {
    registry.remove(id);
    sendEvent('projects:changed', registry.list());
    afterMutation();
    return Promise.resolve();
  });
}
