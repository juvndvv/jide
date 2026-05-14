import { EventEmitter } from 'node:events';
import type { SessionSnapshot } from '@shared/session';
import { ClaudeSession, type ClaudeSessionOptions } from './session.js';

/**
 * Phase 3 invariant: at most one ClaudeSession per worktree.
 * The internal Map already supports `ClaudeSession[]` so Phase 4 only
 * has to lift the cap.
 */
export class SessionManager extends EventEmitter {
  private readonly sessionsByWt = new Map<string, ClaudeSession[]>();

  /**
   * Return the existing session for this worktree, or create one. The
   * returned session is NOT started — call session.start() (or
   * session.send(prompt)) on it to actually spawn the CLI.
   */
  startForWorktree(opts: ClaudeSessionOptions): ClaudeSession {
    const existing = this.sessionsByWt.get(opts.worktreeId) ?? [];
    if (existing.length >= 1) {
      const current = existing[0];
      if (current) return current;
    }
    const session = new ClaudeSession(opts);
    session.on('snapshot', (snap: SessionSnapshot) => this.emit('snapshot', snap));
    session.on('exit', () => {
      const list = this.sessionsByWt.get(opts.worktreeId);
      if (!list) return;
      const i = list.indexOf(session);
      if (i >= 0) list.splice(i, 1);
      if (list.length === 0) this.sessionsByWt.delete(opts.worktreeId);
    });
    this.sessionsByWt.set(opts.worktreeId, [...existing, session]);
    return session;
  }

  getForWorktree(worktreeId: string): ClaudeSession | null {
    return this.sessionsByWt.get(worktreeId)?.[0] ?? null;
  }

  snapshotForWorktree(worktreeId: string): SessionSnapshot | null {
    return this.getForWorktree(worktreeId)?.snapshot() ?? null;
  }

  killForWorktree(worktreeId: string): void {
    const list = this.sessionsByWt.get(worktreeId);
    if (!list) return;
    for (const s of list) s.kill();
    // Map cleanup happens in the session 'exit' listener — deleting eagerly
    // here would race a follow-up startForWorktree against a still-terminating
    // child.
  }

  /**
   * Kill all sessions. Called from app.before-quit to prevent zombies.
   * Idempotent.
   */
  killAll(): void {
    for (const list of this.sessionsByWt.values()) {
      for (const s of list) s.kill();
    }
    // Same race note as killForWorktree — Map entries clean up on exit.
  }

  /** For tests: list active worktree ids. */
  activeWorktrees(): string[] {
    return [...this.sessionsByWt.keys()];
  }
}
