import type { JideStore } from '../store/index.js';
import type { ProjectRegistry } from '../projects/index.js';
import type { SessionManager } from '../claude/manager.js';
import { registerPing } from './ping.js';
import { registerSettings } from './settings.js';
import { registerProjects } from './projects.js';
import { registerWorktrees } from './worktrees.js';
import { registerSessions } from './sessions.js';

export interface IpcDeps {
  store: JideStore;
  registry: ProjectRegistry;
  manager: SessionManager;
  afterProjectsMutation: () => void;
}

export function registerAllHandlers(deps: IpcDeps): void {
  registerPing();
  registerSettings(deps.store);
  registerProjects(deps.registry, deps.afterProjectsMutation);
  registerWorktrees(deps.registry);
  registerSessions(deps.registry, deps.manager, deps.store);
}
