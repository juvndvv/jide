import { createHandler } from './register.js';
import { sendEvent } from './events.js';
import type { ProjectRegistry } from '../projects/index.js';
import type { SessionManager } from '../claude/manager.js';
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

export function registerSessions(registry: ProjectRegistry, manager: SessionManager): void {
  // Single subscription: rebroadcast manager snapshots to all renderers.
  manager.on('snapshot', (snap: SessionSnapshot) => {
    sendEvent('sessions:event', {
      worktreeId: snap.id.worktreeId,
      snapshot: snap,
    });
  });

  createHandler('sessions:start', ({ worktreeId }) => {
    const cwd = resolveWorktreeCwd(registry, worktreeId);
    const session = manager.startForWorktree({ worktreeId, cwd });
    // Don't auto-start the process — let the renderer drive via send().
    return Promise.resolve(session.snapshot());
  });

  createHandler('sessions:send', ({ worktreeId, text }) => {
    const cwd = resolveWorktreeCwd(registry, worktreeId);
    const session =
      manager.getForWorktree(worktreeId) ?? manager.startForWorktree({ worktreeId, cwd });
    session.send(text);
    return Promise.resolve();
  });

  createHandler('sessions:kill', ({ worktreeId }) => {
    manager.killForWorktree(worktreeId);
    return Promise.resolve();
  });

  createHandler('sessions:approve-tool', () => {
    // Phase 3 runs with --permission-mode bypassPermissions, so there is no
    // real approval gate. The handler is a no-op; the renderer can call it
    // without errors so the IPC contract stays stable.
    return Promise.resolve();
  });

  createHandler('sessions:get', ({ worktreeId }) => {
    return Promise.resolve(manager.snapshotForWorktree(worktreeId));
  });
}
