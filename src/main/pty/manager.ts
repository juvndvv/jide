import { EventEmitter } from 'node:events';
import type * as NodePty from 'node-pty';
import type { ShellSpec } from './shell-detect.js';

export interface PtyDataPayload {
  worktreeId: string;
  data: string;
}

export interface PtyExitPayload {
  worktreeId: string;
  code: number | null;
  signal: string | null;
}

interface Active {
  worktreeId: string;
  process: NodePty.IPty;
}

export interface CreateArgs {
  worktreeId: string;
  cwd: string;
  cols: number;
  rows: number;
}

/**
 * Owns a Map<worktreeId, IPty>. Emits 'data' and 'exit'.
 *
 * The node-pty module is dynamic-imported so we can keep the rest of the
 * main bundle loadable when the native binding fails (e.g. dev machine
 * without a rebuild). Use `setPtyModule` from a test or `init()` in prod.
 */
export class PtyManager extends EventEmitter {
  private readonly active = new Map<string, Active>();
  private pty: typeof NodePty | null = null;
  private readonly detector: () => ShellSpec;

  constructor(detector: () => ShellSpec, ptyModule?: typeof NodePty) {
    super();
    this.detector = detector;
    if (ptyModule) this.pty = ptyModule;
  }

  async init(): Promise<void> {
    if (this.pty) return;
    this.pty = await import('node-pty');
  }

  has(worktreeId: string): boolean {
    return this.active.has(worktreeId);
  }

  activeWorktrees(): string[] {
    return [...this.active.keys()];
  }

  create(args: CreateArgs): { pid: number } {
    if (!this.pty) throw new Error('PtyManager not initialised');
    const existing = this.active.get(args.worktreeId);
    if (existing) return { pid: existing.process.pid };
    const shell = this.detector();
    const proc = this.pty.spawn(shell.command, shell.args, {
      cwd: args.cwd,
      cols: Math.max(1, Math.floor(args.cols)),
      rows: Math.max(1, Math.floor(args.rows)),
      env: { ...process.env, TERM: 'xterm-256color' },
      name: 'xterm-256color',
    });
    this.active.set(args.worktreeId, { worktreeId: args.worktreeId, process: proc });
    proc.onData((data) => {
      this.emit('data', { worktreeId: args.worktreeId, data });
    });
    proc.onExit(({ exitCode, signal }) => {
      this.active.delete(args.worktreeId);
      this.emit('exit', {
        worktreeId: args.worktreeId,
        code: exitCode,
        signal: signal != null ? String(signal) : null,
      });
    });
    return { pid: proc.pid };
  }

  write(worktreeId: string, data: string): void {
    const entry = this.active.get(worktreeId);
    if (!entry) return;
    entry.process.write(data);
  }

  resize(worktreeId: string, cols: number, rows: number): void {
    const entry = this.active.get(worktreeId);
    if (!entry) return;
    entry.process.resize(Math.max(1, Math.floor(cols)), Math.max(1, Math.floor(rows)));
  }

  kill(worktreeId: string): void {
    const entry = this.active.get(worktreeId);
    if (!entry) return;
    entry.process.kill();
    this.active.delete(worktreeId);
  }

  killAll(): void {
    for (const id of [...this.active.keys()]) this.kill(id);
  }
}
