import { ipcMain } from 'electron';
import type { Channel, Req, Res } from '@shared/ipc';

export type Handler<C extends Channel> = (payload: Req<C>) => Promise<Res<C>>;

export function createHandler<C extends Channel>(channel: C, handler: Handler<C>): void {
  ipcMain.handle(channel, async (_event, payload: Req<C>) => handler(payload));
}
