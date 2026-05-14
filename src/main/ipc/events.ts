import { BrowserWindow } from 'electron';
import type { Event, EventPayload } from '@shared/ipc';

export function sendEvent<E extends Event>(event: E, payload: EventPayload<E>): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(event, payload);
    }
  }
}
