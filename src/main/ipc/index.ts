import type { JideStore } from '../store/index.js';
import type { ProjectRegistry } from '../projects/index.js';
import type { SessionManager } from '../claude/manager.js';
import type { PtyManager } from '../pty/manager.js';
import { registerPing } from './ping.js';
import { registerSettings } from './settings.js';
import { registerProjects } from './projects.js';
import { registerWorktrees } from './worktrees.js';
import { registerSessions } from './sessions.js';
import { registerTerminalHandlers } from './terminal.js';
import { registerFilesHandlers, type FileWatcherManager } from './files.js';

export interface IpcDeps {
  store: JideStore;
  registry: ProjectRegistry;
  manager: SessionManager;
  afterProjectsMutation: () => void;
  pty?: PtyManager | null;
  getWorktreeRoot: (worktreeId: string) => string | null;
}

export function registerAllHandlers(deps: IpcDeps): { filesManager: FileWatcherManager } {
  const filesManager = registerFilesHandlers(deps.getWorktreeRoot);

  registerPing();
  registerSettings(deps.store);
  registerProjects(deps.registry, deps.afterProjectsMutation);
  registerWorktrees(deps.registry, {
    onWorktreeRemoved: (worktreeId) => filesManager.release(worktreeId),
  });
  registerSessions(deps.registry, deps.manager, deps.store);
  registerTerminalHandlers(deps.pty ?? null);

  return { filesManager };
}
