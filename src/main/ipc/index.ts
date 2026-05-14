import type { JideStore } from '../store/index.js';
import { registerPing } from './ping.js';
import { registerSettings } from './settings.js';

export function registerAllHandlers(store: JideStore): void {
  registerPing();
  registerSettings(store);
}
