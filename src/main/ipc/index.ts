import type { JideStore } from '../store/index.js';
import type { ProjectRegistry } from '../projects/index.js';
import { registerPing } from './ping.js';
import { registerSettings } from './settings.js';
import { registerProjects } from './projects.js';
import { registerWorktrees } from './worktrees.js';

export interface IpcDeps {
  store: JideStore;
  registry: ProjectRegistry;
  afterProjectsMutation: () => void;
}

export function registerAllHandlers(deps: IpcDeps): void {
  registerPing();
  registerSettings(deps.store);
  registerProjects(deps.registry, deps.afterProjectsMutation);
  registerWorktrees(deps.registry);
}
