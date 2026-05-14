import { EventEmitter } from 'node:events';
import { ClaudeSession, type ClaudeSessionOptions } from './session.js';
import type { PersistedSession, SessionSnapshot } from '@shared/session';

export interface SessionManagerOptions {
  /** Configurable cap. SessionManager clamps to [1, 16]. */
  maxSessionsPerWorktree: number;
}

export class SessionManager extends EventEmitter {
  private readonly sessionsByWt = new Map<string, ClaudeSession[]>();
  private maxPerWt: number;

  constructor(opts: SessionManagerOptions = { maxSessionsPerWorktree: 4 }) {
    super();
    this.maxPerWt = clamp(opts.maxSessionsPerWorktree);
  }

  /** Update the cap at runtime. Does NOT kill existing sessions over the new cap. */
  setMaxPerWorktree(n: number): void {
    this.maxPerWt = clamp(n);
  }

  getMaxPerWorktree(): number {
    return this.maxPerWt;
  }

  /**
   * Create a new session for the worktree. Returns the new ClaudeSession.
   * Throws SessionCapReachedError when the cap is reached.
   */
  createForWorktree(opts: ClaudeSessionOptions): ClaudeSession {
    const list = this.sessionsByWt.get(opts.worktreeId) ?? [];
    if (list.length >= this.maxPerWt) {
      throw new SessionCapReachedError(opts.worktreeId, this.maxPerWt);
    }
    const session = this.wire(opts);
    this.sessionsByWt.set(opts.worktreeId, [...list, session]);
    this.emitList(opts.worktreeId);
    return session;
  }

  /**
   * Rehydrate a previously persisted session. Bypasses the cap so the
   * user does not lose history if maxPerWorktree was lowered between
   * runs.
   */
  rehydrate(opts: ClaudeSessionOptions & { seed: PersistedSession }): ClaudeSession {
    const list = this.sessionsByWt.get(opts.worktreeId) ?? [];
    const session = this.wire(opts);
    this.sessionsByWt.set(opts.worktreeId, [...list, session]);
    this.emitList(opts.worktreeId);
    return session;
  }

  getById(worktreeId: string, sessionUuid: string): ClaudeSession | null {
    const list = this.sessionsByWt.get(worktreeId);
    if (!list) return null;
    return list.find((s) => s.snapshot().id.uuid === sessionUuid) ?? null;
  }

  listForWorktree(worktreeId: string): ClaudeSession[] {
    return this.sessionsByWt.get(worktreeId) ?? [];
  }

  snapshotsForWorktree(worktreeId: string): SessionSnapshot[] {
    return this.listForWorktree(worktreeId).map((s) => s.snapshot());
  }

  killById(worktreeId: string, sessionUuid: string): void {
    const session = this.getById(worktreeId, sessionUuid);
    if (session) session.kill();
  }

  killAll(): void {
    for (const list of this.sessionsByWt.values()) {
      for (const s of list) s.kill();
    }
  }

  /** For tests: list active worktree ids. */
  activeWorktrees(): string[] {
    return [...this.sessionsByWt.keys()];
  }

  private drop(worktreeId: string, session: ClaudeSession): void {
    const list = this.sessionsByWt.get(worktreeId);
    if (!list) return;
    const i = list.indexOf(session);
    if (i >= 0) list.splice(i, 1);
    if (list.length === 0) this.sessionsByWt.delete(worktreeId);
    this.emitList(worktreeId);
  }

  private wire(opts: ClaudeSessionOptions): ClaudeSession {
    const session = new ClaudeSession(opts);
    session.on('snapshot', (snap: SessionSnapshot) => {
      this.emit('snapshot', snap);
      this.emit('list-changed', {
        worktreeId: opts.worktreeId,
        sessions: this.snapshotsForWorktree(opts.worktreeId),
      });
    });
    session.on('exit', () => this.drop(opts.worktreeId, session));
    return session;
  }

  private emitList(worktreeId: string): void {
    this.emit('list-changed', {
      worktreeId,
      sessions: this.snapshotsForWorktree(worktreeId),
    });
  }
}

export class SessionCapReachedError extends Error {
  readonly code = 'SESSION_CAP_REACHED' as const;
  readonly worktreeId: string;
  readonly cap: number;
  constructor(worktreeId: string, cap: number) {
    super(`Session cap reached for worktree ${worktreeId} (max ${cap})`);
    this.worktreeId = worktreeId;
    this.cap = cap;
  }
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 4;
  return Math.max(1, Math.min(16, Math.round(n)));
}
