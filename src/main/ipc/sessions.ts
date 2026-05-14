import { createHandler } from './register.js';
import { sendEvent } from './events.js';
import type { ProjectRegistry } from '../projects/index.js';
import type { JideStore } from '../store/index.js';
import { SessionCapReachedError, type SessionManager } from '../claude/manager.js';
import type { SessionSnapshot } from '@shared/session';

function resolveWorktreeCwd(registry: ProjectRegistry, worktreeId: string): string {
  const sep = worktreeId.indexOf(':');
  if (sep < 0) throw new Error(`Bad worktree id: ${worktreeId}`);
  const repoRoot = worktreeId.slice(0, sep);
  const worktreePath = worktreeId.slice(sep + 1);
  const known = registry.list().some((p) => p.path === repoRoot);
  if (!known) {
    throw new Error(`Worktree ${worktreeId} does not belong to a registered project`);
  }
  return worktreePath;
}

export function registerSessions(
  registry: ProjectRegistry,
  manager: SessionManager,
  store: JideStore,
): void {
  manager.on('snapshot', (snap: SessionSnapshot) => {
    sendEvent('sessions:event', { worktreeId: snap.id.worktreeId, snapshot: snap });
  });

  manager.on('list-changed', (payload: { worktreeId: string; sessions: SessionSnapshot[] }) => {
    sendEvent('sessions:list-changed', payload);
  });

  createHandler('sessions:list', ({ worktreeId }) => {
    return Promise.resolve(manager.snapshotsForWorktree(worktreeId));
  });

  createHandler('sessions:create', ({ worktreeId }) => {
    const cwd = resolveWorktreeCwd(registry, worktreeId);
    try {
      const session = manager.createForWorktree({ worktreeId, cwd });
      return Promise.resolve(session.snapshot());
    } catch (err) {
      if (err instanceof SessionCapReachedError) {
        return Promise.reject(new Error(`SESSION_CAP_REACHED: ${err.cap}`));
      }
      throw err;
    }
  });

  createHandler('sessions:send', ({ worktreeId, sessionId, text }) => {
    const session = manager.getById(worktreeId, sessionId);
    if (!session) {
      return Promise.reject(new Error(`Session ${sessionId} not found in ${worktreeId}`));
    }
    session.send(text);
    return Promise.resolve();
  });

  createHandler('sessions:kill', ({ worktreeId, sessionId }) => {
    manager.killById(worktreeId, sessionId);
    return Promise.resolve();
  });

  createHandler('sessions:get', ({ worktreeId, sessionId }) => {
    const s = manager.getById(worktreeId, sessionId);
    return Promise.resolve(s ? s.snapshot() : null);
  });

  createHandler('sessions:approve-tool', () => {
    return Promise.resolve();
  });

  createHandler('sessions:rename', ({ worktreeId, sessionId, title }) => {
    const s = manager.getById(worktreeId, sessionId);
    if (s) s.rename(title);
    return Promise.resolve();
  });

  createHandler('sessions:set-active', ({ worktreeId, sessionId }) => {
    const map = store.get('activeSessionByWt') ?? {};
    store.set('activeSessionByWt', { ...map, [worktreeId]: sessionId });
    return Promise.resolve();
  });

  createHandler('sessions:get-active', ({ worktreeId }) => {
    const map = store.get('activeSessionByWt') ?? {};
    return Promise.resolve(map[worktreeId] ?? null);
  });
}
