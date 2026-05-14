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
  private readonly sessionId: SessionId;
  private readonly model: string;
  private snapshotState: SessionSnapshot;
  private proc: ChildProcess | null = null;
  private rl: ReadlineInterface | null = null;

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
    if (this.proc) return;
    const builder = this.opts.argsBuilder ?? defaultArgs;
    const args = builder(this.sessionId.uuid, this.model);
    this.proc = spawn(claudeBinary(), args, {
      cwd: this.opts.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    this.updateSnapshot({ ...this.snapshotState, status: 'starting' });

    this.rl = createInterface({ input: this.proc.stdout! });
    this.rl.on('line', (line) => this.handleLine(line));

    this.proc.stderr?.on('data', (chunk: Buffer | string) => {
      // Surface stderr to main-process console for now; renderer wiring lands in a later phase.
      console.error('[claude stderr]', chunk.toString());
    });

    this.proc.on('exit', (code) => {
      const status = code === 0 ? 'exited' : 'error';
      this.updateSnapshot({ ...this.snapshotState, status });
      this.emit('exit', code);
      this.proc = null;
      this.rl = null;
    });
  }

  /**
   * Push a user prompt on stdin and append a user Message to the snapshot
   * immediately so the renderer reflects the prompt without waiting for the
   * CLI (stream-json mode does not echo user messages back).
   */
  send(text: string): void {
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
    if (!this.proc) return;
    this.proc.kill();
    this.rl?.close();
    this.proc = null;
    this.rl = null;
  }

  private handleLine(line: string): void {
    const event = parseEventLine(line);
    if (!event) return;
    this.updateSnapshot(applyEvent(this.snapshotState, event));
  }

  private updateSnapshot(next: SessionSnapshot): void {
    this.snapshotState = next;
    this.emit('snapshot', next);
  }
}
