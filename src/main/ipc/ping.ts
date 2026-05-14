import { createHandler } from './register.js';

export function registerPing(): void {
  createHandler('ping', () => Promise.resolve('pong'));
}
