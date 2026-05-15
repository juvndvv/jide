import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerWorktrees } from '../../../../src/main/ipc/worktrees';
import type { ProjectRegistry } from '../../../../src/main/projects/index';

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

const { sendEventMock } = vi.hoisted(() => ({
  sendEventMock: vi.fn(),
}));

vi.mock('../../../../src/main/ipc/events', () => ({
  sendEvent: sendEventMock,
}));

const { removeWorktreeMock, worktreesMock } = vi.hoisted(() => ({
  removeWorktreeMock: vi.fn<(path: string) => Promise<void>>(),
  worktreesMock: vi.fn<() => Promise<unknown[]>>(),
}));

vi.mock('../../../../src/main/git/index', () => ({
  createGitClient: vi.fn(() => ({
    removeWorktree: removeWorktreeMock,
    worktrees: worktreesMock,
    branches: vi.fn().mockResolvedValue([]),
  })),
}));

function makeRegistry(projectPath = '/repo/project'): ProjectRegistry {
  return {
    list: () => [{ id: 'proj-1', path: projectPath, name: 'project' }],
    add: vi.fn(),
    remove: vi.fn(),
  } as unknown as ProjectRegistry;
}

function getRegisteredHandler(channel: string): WrappedHandler {
  const call = handleMock.mock.calls.find(([c]) => c === channel);
  if (!call) throw new Error(`No handler registered for channel: ${channel}`);
  return call[1];
}

describe('registerWorktrees — onWorktreeRemoved callback', () => {
  beforeEach(() => {
    handleMock.mockClear();
    sendEventMock.mockClear();
    removeWorktreeMock.mockReset();
    worktreesMock.mockReset();
  });

  it('calls onWorktreeRemoved with the correct worktreeId after a successful remove', async () => {
    const projectPath = '/repo/my-project';
    const worktreePath = '/repo/my-project-wt';
    const registry = makeRegistry(projectPath);
    const onWorktreeRemoved = vi.fn();

    removeWorktreeMock.mockResolvedValue(undefined);
    worktreesMock.mockResolvedValue([]);

    registerWorktrees(registry, { onWorktreeRemoved });

    const handler = getRegisteredHandler('worktrees:remove');
    await handler({}, { projectId: 'proj-1', worktreePath });

    expect(onWorktreeRemoved).toHaveBeenCalledOnce();
    expect(onWorktreeRemoved).toHaveBeenCalledWith(`${projectPath}:${worktreePath}`);
  });

  it('does not throw when no onWorktreeRemoved callback is provided', async () => {
    const registry = makeRegistry('/repo/project');

    removeWorktreeMock.mockResolvedValue(undefined);
    worktreesMock.mockResolvedValue([]);

    registerWorktrees(registry);

    const handler = getRegisteredHandler('worktrees:remove');
    await expect(handler({}, { projectId: 'proj-1', worktreePath: '/repo/wt' })).resolves.not.toThrow();
  });

  it('still emits worktrees:changed before invoking the callback', async () => {
    const projectPath = '/repo/project';
    const worktreePath = '/repo/wt';
    const registry = makeRegistry(projectPath);
    const callOrder: string[] = [];

    removeWorktreeMock.mockResolvedValue(undefined);
    worktreesMock.mockResolvedValue([]);
    sendEventMock.mockImplementation(() => callOrder.push('sendEvent'));
    const onWorktreeRemoved = vi.fn(() => callOrder.push('onWorktreeRemoved'));

    registerWorktrees(registry, { onWorktreeRemoved });

    const handler = getRegisteredHandler('worktrees:remove');
    await handler({}, { projectId: 'proj-1', worktreePath });

    expect(callOrder).toEqual(['sendEvent', 'onWorktreeRemoved']);
  });
});
