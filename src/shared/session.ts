export type SessionStatus =
  | 'idle'
  | 'starting'
  | 'requesting'
  | 'streaming'
  | 'awaiting'
  | 'error'
  | 'exited';

export interface SessionId {
  worktreeId: string;
  /** Stable session UUID from the CLI's system/init event. */
  uuid: string;
}

/**
 * Discriminated union over the message types the chat panel renders.
 * Built by the protocol parser by folding raw CLI events:
 *   - `assistant.text` blocks → `claude` messages.
 *   - `assistant.thinking` blocks → `claude` messages with `thinking: true` (renderer may hide or dim).
 *   - `assistant.tool_use` + `user.tool_result` → a single `tool` message that transitions
 *     from 'running' → 'done' (or 'error') when the result arrives.
 *   - rate_limit_event with warning/exceeded → `system` message.
 *   - result with is_error → `system` message.
 *   - User prompts the renderer sends → `user` messages (echoed back via the same parser).
 */
export type Message =
  | { type: 'user'; id: string; text: string; ts: number }
  | {
      type: 'claude';
      id: string;
      text: string;
      ts: number;
      thinking?: boolean;
      streaming?: boolean;
    }
  | {
      type: 'tool';
      id: string;
      /** Anthropic tool name, e.g. 'Bash', 'Edit', 'Read'. */
      name: string;
      /** Original `tool_use.input` object from the CLI. */
      input: Record<string, unknown>;
      status: 'pending' | 'approved' | 'denied' | 'running' | 'done' | 'error';
      /** Concatenated `tool_result.content` text once the tool finishes. */
      output?: string;
      /** True if the `tool_result` came back with is_error. */
      isError?: boolean;
      ts: number;
    }
  | { type: 'diff'; id: string; file: string; lines: DiffLine[]; ts: number }
  | { type: 'system'; id: string; text: string; level: 'info' | 'warn' | 'error'; ts: number };

export interface DiffLine {
  sign: '+' | '-' | ' ';
  text: string;
}

export interface RateLimitInfo {
  /** e.g. 'allowed_warning', 'exceeded'. */
  status: string;
  /** Type of limit, e.g. 'seven_day'. */
  limitType: string;
  /** 0..1. */
  utilization: number;
  /** Unix seconds. */
  resetsAtSec: number;
}

export interface SessionSnapshot {
  id: SessionId;
  status: SessionStatus;
  model: string;
  cwd: string;
  messages: Message[];
  /** Set when the most recent rate_limit_event indicated a warning or exceeded state. */
  rateLimit: RateLimitInfo | null;
  /** Tool use id awaiting an approval response, if any. Phase 3 keeps this null (bypassPermissions mode). */
  awaitingToolUseId: string | null;
  /** From the CLI result event, accumulated across turns. */
  totalCostUsd: number;
}
