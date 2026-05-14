import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface, type Interface as ReadlineInterface } from 'node:readline';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { SessionId, SessionSnapshot } from '@shared/session';
import { applyEvent, emptySnapshot, parseEventLine } from './protocol.js';
import { claudeBinary } from './locator.js';

export interface ClaudeSessionOptions {
  worktreeId: string;
  cwd: string;
  model?: string;
  /**
   * Test seam: override the CLI args. Default is the real `claude` flag set
   * locked in by the Phase 3 spike. Tests pass fake-claude.mjs args here so
   * the spawn binary stays `node` (set via setClaudeBinaryForTests).
   */
  argsBuilder?: (sessionUuid: string, model: string) => string[];
}

/**
 * Default flag set for the real `claude` CLI, frozen at the values the
 * Phase 3 spike confirmed: stream-json in both directions, verbose mode
 * (required alongside -p), bypassPermissions for MVP, pinned session id.
 * --include-partial-messages is intentionally absent.
 */
function defaultArgs(sessionUuid: string, model: string): string[] {
  return [
    '-p',
    '--verbose',
    '--output-format',
    'stream-json',
    '--input-format',
    'stream-json',
    '--session-id',
    sessionUuid,
    '--model',
    model,
    '--permission-mode',
    'bypassPermissions',
  ];
}

/**
 * One long-lived `claude` subprocess per worktree session (Scenario A from
 * the Phase 3 spike). Multi-turn prompts reuse the same process via stdin
 * streaming, avoiding the cache-creation tax of spawning per turn.
 */
export class ClaudeSession extends EventEmitter {
  private readonly opts: ClaudeSessionOptions;
  // Mutable: each start() mints a fresh UUID so "kill == fresh session" — the
  // simplest mental model for Phase 3. SessionManager will own re-attachment.
  private sessionId: SessionId;
  private readonly model: string;
  private snapshotState: SessionSnapshot;
  private proc: ChildProcess | null = null;
  private rl: ReadlineInterface | null = null;
  // True once the underlying process has exited (naturally or via kill). Gates
  // send() and handleLine() so late stdout / accidental sends cannot mutate
  // the final snapshot or silently respawn a new CLI with a new session-id.
  private terminated = false;
  // Set while kill() is escalating SIGTERM → SIGKILL; blocks start() reentry.
  private killing = false;
  private killTimer: NodeJS.Timeout | null = null;
  // Registered on `process.on('exit')` while the child is alive so a parent
  // crash doesn't leave a zombie `claude`. Cleared on exit/kill.
  private exitGuard?: () => void;

  constructor(opts: ClaudeSessionOptions) {
    super();
    this.opts = opts;
    this.model = opts.model ?? 'sonnet';
    this.sessionId = { worktreeId: opts.worktreeId, uuid: randomUUID() };
    this.snapshotState = {
      ...emptySnapshot(opts.worktreeId, this.model, opts.cwd),
      id: this.sessionId,
    };
  }

  snapshot(): SessionSnapshot {
    return this.snapshotState;
  }

  /** Spawn the underlying `claude` process. Idempotent. */
  start(): void {
    if (this.proc || this.killing) return;
    // Re-start after a natural exit: refresh identity and clear the terminal
    // flag so handleLine and send work again. A fresh UUID is intentional —
    // the CLI session is gone; this is a brand-new conversation.
    if (this.terminated) {
      this.sessionId = { worktreeId: this.opts.worktreeId, uuid: randomUUID() };
      this.snapshotState = {
        ...emptySnapshot(this.opts.worktreeId, this.model, this.opts.cwd),
        id: this.sessionId,
      };
      this.terminated = false;
    }
    // E2E test seam: when both env vars are set, bypass the real CLI args
    // and spawn `node <fakeBin> --script <fakeScript>` directly. This keeps
    // the launcher in main while the test controls the script content.
    const fakeBin = process.env.JIDE_FAKE_CLAUDE_BIN;
    const fakeScript = process.env.JIDE_CLAUDE_FAKE_SCRIPT;
    if (fakeBin && fakeScript) {
      this.proc = spawn('node', [fakeBin, '--script', fakeScript], {
        cwd: this.opts.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });
    } else {
      const builder = this.opts.argsBuilder ?? defaultArgs;
      const args = builder(this.sessionId.uuid, this.model);
      this.proc = spawn(claudeBinary(), args, {
        cwd: this.opts.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });
    }
    this.updateSnapshot({ ...this.snapshotState, status: 'starting' });

    this.exitGuard = () => {
      if (this.proc) this.proc.kill('SIGKILL');
    };
    process.on('exit', this.exitGuard);

    this.rl = createInterface({ input: this.proc.stdout! });
    this.rl.on('line', (line) => this.handleLine(line));

    this.proc.stderr?.on('data', (chunk: Buffer | string) => {
      // Surface stderr to main-process console for now; renderer wiring lands in a later phase.
      console.error('[claude stderr]', chunk.toString());
    });

    this.proc.on('error', (err) => {
      this.terminated = true;
      const messages = this.snapshotState.messages;
      this.updateSnapshot({
        ...this.snapshotState,
        status: 'error',
        messages: [
          ...messages,
          {
            type: 'system',
            id: `spawn-error-${messages.length}`,
            text: `Failed to spawn claude: ${err.message}`,
            level: 'error',
            ts: messages.length,
          },
        ],
      });
    });

    this.proc.on('exit', (code) => {
      // Flip terminated BEFORE emitting the final snapshot so any concurrent
      // line handlers short-circuit and cannot overwrite it.
      this.terminated = true;
      if (this.killTimer) {
        clearTimeout(this.killTimer);
        this.killTimer = null;
      }
      if (this.exitGuard) {
        process.removeListener('exit', this.exitGuard);
        this.exitGuard = undefined;
      }
      this.killing = false;
      this.proc = null;
      this.rl = null;
      const status = code === 0 ? 'exited' : 'error';
      this.updateSnapshot({ ...this.snapshotState, status });
      this.emit('exit', code);
    });
  }

  /**
   * Push a user prompt on stdin and append a user Message to the snapshot
   * immediately so the renderer reflects the prompt without waiting for the
   * CLI (stream-json mode does not echo user messages back).
   */
  send(text: string): void {
    if (this.terminated) {
      const messages = this.snapshotState.messages;
      this.updateSnapshot({
        ...this.snapshotState,
        status: 'error',
        messages: [
          ...messages,
          {
            type: 'system',
            id: `system-after-exit-${messages.length}`,
            text: 'Session has exited. Start a new session to continue.',
            level: 'error',
            ts: messages.length,
          },
        ],
      });
      return;
    }
    if (!this.proc) this.start();
    const payload = {
      type: 'user' as const,
      message: {
        role: 'user' as const,
        content: [{ type: 'text', text }],
      },
    };
    this.proc!.stdin!.write(JSON.stringify(payload) + '\n');
    const messages = this.snapshotState.messages;
    this.updateSnapshot({
      ...this.snapshotState,
      status: 'requesting',
      messages: [
        ...messages,
        {
          type: 'user',
          id: `user-${messages.length}`,
          text,
          ts: messages.length,
        },
      ],
    });
  }

  /** Terminate the underlying process and close pipes. Idempotent. */
  kill(): void {
    if (!this.proc || this.killing) return;
    if (this.exitGuard) {
      process.removeListener('exit', this.exitGuard);
      this.exitGuard = undefined;
    }
    this.killing = true;
    this.proc.kill('SIGTERM');
    this.rl?.close();
    this.killTimer = setTimeout(() => {
      if (this.proc) this.proc.kill('SIGKILL');
    }, 3_000);
  }

  private handleLine(line: string): void {
    if (this.terminated) return;
    const event = parseEventLine(line);
    if (!event) return;
    this.updateSnapshot(applyEvent(this.snapshotState, event));
  }

  private updateSnapshot(next: SessionSnapshot): void {
    this.snapshotState = next;
    this.emit('snapshot', next);
  }
}
