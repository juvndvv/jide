import { createHandler } from './register.js';
import type { JideStore } from '../store/index.js';

export function registerSettings(store: JideStore): void {
  createHandler('settings:get', ({ key }) => Promise.resolve(store.get(key)));
  createHandler('settings:set', ({ key, value }) => {
    store.set(key, value);
    return Promise.resolve();
  });
}
