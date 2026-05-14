import type { JideStore } from '../store/index.js';
import type { PersistedSession } from '@shared/session';

export function loadAllSessions(store: JideStore): Record<string, PersistedSession[]> {
  return store.get('sessions') ?? {};
}

export function saveSessionsForWorktree(
  store: JideStore,
  worktreeId: string,
  sessions: PersistedSession[],
): void {
  const all = { ...loadAllSessions(store) };
  if (sessions.length === 0) {
    delete all[worktreeId];
  } else {
    all[worktreeId] = sessions;
  }
  store.set('sessions', all);
}

export function clearSessionsForWorktree(store: JideStore, worktreeId: string): void {
  saveSessionsForWorktree(store, worktreeId, []);
}
