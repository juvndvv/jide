import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHandler } from '../../../../src/main/ipc/register';

type WrappedHandler = (event: unknown, payload: unknown) => Promise<unknown>;
type HandleFn = (this: void, channel: string, listener: WrappedHandler) => void;

const { handleMock } = vi.hoisted(() => ({
  handleMock: vi.fn<HandleFn>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
    removeHandler: vi.fn(),
  },
}));

describe('createHandler', () => {
  beforeEach(() => {
    handleMock.mockClear();
  });

  it('registers an ipcMain handler for the given channel', () => {
    createHandler('ping', () => Promise.resolve('pong'));
    expect(handleMock).toHaveBeenCalledWith('ping', expect.any(Function));
  });

  it('passes through the handler return value', async () => {
    createHandler('ping', () => Promise.resolve('pong'));
    const call = handleMock.mock.calls[0];
    if (!call) throw new Error('ipcMain.handle was not called');
    const wrapped = call[1];
    const result = await wrapped({}, undefined);
    expect(result).toBe('pong');
  });
});
