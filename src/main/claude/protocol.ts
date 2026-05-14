import type { Message, RateLimitInfo, SessionSnapshot, SessionStatus } from '@shared/session';

/** Inner content block on an `assistant` event's `message.content[]`. */
export type ContentBlock =
  | { type: 'thinking'; thinking: string }
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

/** Inner block on a `user` event's `message.content[]` (only tool_result observed). */
export type UserContentBlock = {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<{ type: string; text?: string }>;
  is_error?: boolean;
};

export type SystemEvent =
  | {
      type: 'system';
      subtype: 'init';
      session_id?: string;
      cwd?: string;
      model?: string;
      permissionMode?: string;
    }
  | { type: 'system'; subtype: 'status'; status: string }
  | { type: 'system'; subtype: 'hook_started' }
  | { type: 'system'; subtype: 'hook_response' };

export type AssistantEvent = {
  type: 'assistant';
  message: {
    id: string;
    content: ContentBlock[];
    stop_reason?: string | null;
  };
};

export type UserEvent = {
  type: 'user';
  message: { role: 'user'; content: UserContentBlock[] };
  /** CLI augmentation: present on tool_result events. */
  tool_use_result?: {
    stdout: string;
    stderr: string;
    interrupted: boolean;
    isImage: boolean;
  };
};

export type ResultEvent = {
  type: 'result';
  subtype: string;
  is_error: boolean;
  api_error_status: number | null;
  total_cost_usd: number;
  num_turns: number;
  stop_reason: string;
  result?: string;
  permission_denials?: unknown[];
  terminal_reason?: string;
};

export type RateLimitEvent = {
  type: 'rate_limit_event';
  rate_limit_info: {
    status: string;
    rateLimitType: string;
    utilization: number;
    resetsAt: number;
    isUsingOverage?: boolean;
    surpassedThreshold?: number;
  };
};

export type StreamEvent =
  | SystemEvent
  | AssistantEvent
  | UserEvent
  | ResultEvent
  | RateLimitEvent
  // stream_event is observed only with --include-partial-messages, which we
  // don't pass. Typed so we can drop it explicitly rather than as "unknown".
  | { type: 'stream_event'; event: unknown };

/**
 * Parse one NDJSON line into a `StreamEvent`. Returns null for empty input,
 * malformed JSON, or unknown event types — the caller decides whether to log.
 */
export function parseEventLine(line: string): StreamEvent | null {
  if (!line.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.type !== 'string') return null;
  switch (obj.type) {
    case 'system':
    case 'assistant':
    case 'user':
    case 'result':
    case 'rate_limit_event':
    case 'stream_event':
      return obj as unknown as StreamEvent;
    default:
      return null;
  }
}

/**
 * Reduce a `StreamEvent` into a new `SessionSnapshot`. Pure function — the
 * caller threads state. Dedup rule for assistant content blocks:
 *   - text blocks: keyed by `${message.id}:text`. Later events REPLACE the
 *     accumulated text (the CLI emits cumulative content arrays per id).
 *   - thinking blocks: keyed by `${message.id}:thinking`, REPLACE.
 *   - tool_use blocks: keyed by the block's own `id` (toolu_*), insert-only.
 *
 * Hook events (system/hook_started, system/hook_response) and stream_event
 * are silently dropped.
 */
export function applyEvent(prev: SessionSnapshot, event: StreamEvent): SessionSnapshot {
  switch (event.type) {
    case 'system': {
      if (event.subtype === 'init') {
        const nextStatus: SessionStatus = prev.status === 'idle' ? 'starting' : prev.status;
        return {
          ...prev,
          status: nextStatus,
          model: event.model ?? prev.model,
          cwd: event.cwd ?? prev.cwd,
          id: { ...prev.id, uuid: event.session_id ?? prev.id.uuid },
        };
      }
      if (event.subtype === 'status') {
        const next: SessionStatus = event.status === 'requesting' ? 'requesting' : prev.status;
        return { ...prev, status: next };
      }
      return prev;
    }
    case 'assistant':
      return applyAssistantEvent(prev, event);
    case 'user':
      return applyUserEvent(prev, event);
    case 'result':
      return applyResultEvent(prev, event);
    case 'rate_limit_event':
      return { ...prev, rateLimit: rateLimitFrom(event) };
    case 'stream_event':
      return prev;
  }
}

function applyAssistantEvent(prev: SessionSnapshot, event: AssistantEvent): SessionSnapshot {
  const msgId = event.message.id;
  const messages = [...prev.messages];
  const textBlocks = event.message.content.filter(
    (b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text',
  );
  const thinkingBlocks = event.message.content.filter(
    (b): b is Extract<ContentBlock, { type: 'thinking' }> => b.type === 'thinking',
  );
  const toolUseBlocks = event.message.content.filter(
    (b): b is Extract<ContentBlock, { type: 'tool_use' }> => b.type === 'tool_use',
  );

  if (textBlocks.length > 0) {
    const text = textBlocks.map((b) => b.text).join('');
    const id = `${msgId}:text`;
    const existingIdx = messages.findIndex((m) => m.type === 'claude' && m.id === id);
    const claudeMsg: Message = {
      type: 'claude',
      id,
      text,
      ts: existingIdx >= 0 ? (messages[existingIdx]?.ts ?? messages.length) : messages.length,
    };
    if (existingIdx >= 0) messages[existingIdx] = claudeMsg;
    else messages.push(claudeMsg);
  }

  if (thinkingBlocks.length > 0) {
    const text = thinkingBlocks.map((b) => b.thinking).join('');
    const id = `${msgId}:thinking`;
    const existingIdx = messages.findIndex((m) => m.type === 'claude' && m.id === id);
    const thinkingMsg: Message = {
      type: 'claude',
      id,
      text,
      thinking: true,
      ts: existingIdx >= 0 ? (messages[existingIdx]?.ts ?? messages.length) : messages.length,
    };
    if (existingIdx >= 0) messages[existingIdx] = thinkingMsg;
    else messages.push(thinkingMsg);
  }

  for (const block of toolUseBlocks) {
    const existingIdx = messages.findIndex((m) => m.type === 'tool' && m.id === block.id);
    if (existingIdx < 0) {
      messages.push({
        type: 'tool',
        id: block.id,
        name: block.name,
        input: block.input,
        status: 'running',
        ts: messages.length,
      });
    }
  }

  return { ...prev, status: 'streaming', messages };
}

function applyUserEvent(prev: SessionSnapshot, event: UserEvent): SessionSnapshot {
  const messages = [...prev.messages];
  for (const block of event.message.content) {
    if (block.type !== 'tool_result') continue;
    const toolIdx = messages.findIndex((m) => m.type === 'tool' && m.id === block.tool_use_id);
    if (toolIdx < 0) continue;
    const tool = messages[toolIdx];
    if (tool?.type !== 'tool') continue;
    const outputText =
      typeof block.content === 'string'
        ? block.content
        : block.content.map((c) => (typeof c.text === 'string' ? c.text : '')).join('');
    messages[toolIdx] = {
      ...tool,
      status: block.is_error ? 'error' : 'done',
      output: outputText,
      isError: block.is_error,
    };
  }
  return { ...prev, messages };
}

function applyResultEvent(prev: SessionSnapshot, event: ResultEvent): SessionSnapshot {
  const messages = [...prev.messages];
  if (event.is_error) {
    messages.push({
      type: 'system',
      id: `result:${prev.messages.length}`,
      text: event.result ?? `Error (api ${event.api_error_status ?? 'unknown'})`,
      level: 'error',
      ts: messages.length,
    });
  }
  return {
    ...prev,
    status: event.is_error ? 'error' : 'idle',
    messages,
    totalCostUsd: prev.totalCostUsd + (event.total_cost_usd ?? 0),
  };
}

function rateLimitFrom(event: RateLimitEvent): RateLimitInfo {
  return {
    status: event.rate_limit_info.status,
    limitType: event.rate_limit_info.rateLimitType,
    utilization: event.rate_limit_info.utilization,
    resetsAtSec: event.rate_limit_info.resetsAt,
  };
}

/** Initial empty snapshot for a worktree session, before any event arrives. */
export function emptySnapshot(worktreeId: string, model: string, cwd: string): SessionSnapshot {
  return {
    id: { worktreeId, uuid: '' },
    status: 'idle',
    model,
    cwd,
    title: '',
    createdAt: Date.now(),
    messages: [],
    rateLimit: null,
    awaitingToolUseId: null,
    totalCostUsd: 0,
  };
}
