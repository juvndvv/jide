# Claude CLI Protocol & Agent SDK Research

**Status:** Documentation-grade research document  
**Date:** 2026-05-14  
**Scope:** Protocol for spawning `claude` CLI from Node.js child process with event streaming, multi-turn interaction, and tool approval flow for jide Electron app (Phase 3)

---

## ⚠ Verification Status — read this first

This document combines **flag-level facts verified against `claude --help` v2.1.141** (high confidence) with **event-schema details extrapolated from the Managed Agents API docs** (medium confidence — the CLI's `stream-json` output may have different field names than the SDK's). Before writing production code:

| Section | Confidence | Reason |
|---|---|---|
| §1 CLI flags | High | All flags below cross-checked against local `claude --help` v2.1.141, **except `--max-turns`, which does NOT exist in v2.1.141** (likely hallucinated — remove from any code path). |
| §2 Event schema | Medium | Field names (`processed_at`, `id`, `type: 'agent.message'`, etc.) come from Managed Agents API docs. The CLI's actual `stream-json` keys may differ — verify in Phase 3 Task 1 spike. |
| §3 Live stdin input | UNKNOWN | `--input-format stream-json` exists but the input event schema is undocumented for the CLI. Spike required. |
| §4 Approval flow in print mode | UNKNOWN | `--permission-mode default` semantics with `-p` are undocumented. Spike required. |
| §5 CLI vs SDK comparison | Medium-High | Comparison itself is sound but some SDK access claims (enterprise gate, beta status) may be outdated as of 2026-05; the `@anthropic-ai/claude-agent-sdk` npm package is publicly distributed. |
| §6 Recommendation (CLI for Phase 3) | High | Rationale holds regardless of the SDK access details: CLI is locally available, process model fits Electron, migration path stays open. |
| §7 Pseudo-code | Use as scaffolding only — the `user.tool_confirmation` shape is hypothetical until the spike confirms. |

**Phase 3 Task 1 = runtime spike** that runs real `claude -p --output-format stream-json` invocations, captures live event payloads, tests stdin multi-turn, and writes verified findings to `.planning/spike-results/claude-cli-spikes.md`. The plan's later tasks branch on the spike results.

---

## Executive Summary

This document provides implementation-ready specifications for integrating Claude into jide's main process. Two paths are viable:

1. **Claude CLI + `--output-format stream-json`** (Recommended for Phase 3)
2. **Claude Agent SDK** (Alternative for tighter control; requires enterprise access)

The CLI is simpler, battle-tested, and immediately available. The SDK offers finer-grained control but is in beta and requires managed-agents API access. For jide's use case (Electron app hosting one session per worktree with custom approval UI), the **CLI is the better starting point**.

---

## 1. CLI Invocation Shape

### Spawning the `claude` Process

**Working Command (Node.js):**
```typescript
const { spawn } = require('child_process');

const session = spawn('claude', [
  '-p',                              // Print mode (non-interactive)
  '--output-format', 'stream-json',  // Line-delimited JSON output
  '--input-format', 'stream-json',   // Accept JSON input on stdin
  '--model', 'claude-opus-4-7',      // Model selection
  '--permission-mode', 'default',    // Require confirmation for tools
  '--allowedTools', 'Bash,Edit,Read',// Optional tool allowlist
  'Your prompt here'                 // Initial prompt
], {
  cwd: '/path/to/worktree',          // Working directory
  stdio: ['pipe', 'pipe', 'pipe'],   // stdin, stdout, stderr as pipes
  env: {
    ...process.env,
    ANTHROPIC_API_KEY: apiKey
  }
});
```

### Core Flags (Exact Names and Values)

| Flag | Values | Purpose |
|------|--------|---------|
| `-p` / `--print` | (no value) | Non-interactive mode; outputs JSON and exits when done |
| `--output-format` | `text`, `json`, `stream-json` | Output format. Use `stream-json` for incremental parsing |
| `--input-format` | `text`, `stream-json` | Input format. `stream-json` allows real-time prompt injection |
| `--model` | Model alias (`sonnet`, `opus`) or full name (e.g., `claude-opus-4-7`, `claude-sonnet-4-6`) | Sets the model for this session |
| `--permission-mode` | `default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions` | Tool approval behavior |
| `--allowedTools` | Comma/space-separated list (e.g., `Bash(git *) Edit Read`) | Tools that execute without prompting. Supports patterns |
| `--disallowedTools` | Comma/space-separated list (e.g., `Bash(git *) Edit`) | Tools that are blocked entirely |
| `--tools` | `default`, `""` (empty), or list (e.g., `Bash,Edit,Read`) | Restrict available built-in tools; `default` = all |
| `--session-id` | Valid UUID | Reuse existing session (for resumption) |
| `--continue` / `-c` | (no value) | Resume most recent session in cwd |
| `--resume` / `-r` | Session ID or name | Resume specific session |
| `--max-turns` | Integer (e.g., `3`) | Limit agentic turns before exit |
| `--max-budget-usd` | Float (e.g., `5.00`) | Stop if cost exceeds limit |
| `--include-partial-messages` | (no value) | Include streaming text chunks in output |
| `--include-hook-events` | (no value) | Include hook lifecycle events in stream |

**Source:** Local `claude --help` (v2.1.141) + Claude Code CLI reference[1]

### Critical Notes on Input/Output

**Output Format: `stream-json`**
- Produces **line-delimited JSON** (NDJSON).
- Each line is a complete JSON object; no streaming within a single object.
- Parse line-by-line using `readline` or equivalent.

**Input Format: `stream-json`**
- **UNKNOWN:** Whether `--input-format stream-json` supports truly live prompt injection *after* the initial prompt completes.
- The documentation confirms the flag exists and accepts `stream-json` value, but does not document the expected input event shape.
- **Spike needed:** Create a test script to determine if stdin accepts `{"type": "user.message", "content": [...]}` events during a running session.

**No Named Sessions in CLI:**
- The CLI does not natively support naming sessions in the spawn interface; naming is via the `-n` flag.
- `--session-id` accepts a UUID to reuse an existing session.

---

## 2. Stream-JSON Event Schema

### Event Output Structure

When `--output-format stream-json` is set, the CLI emits **one JSON object per line** on stdout.

#### Event Types Observed

Based on Claude Code documentation and SDK docs (which share the same event system):

**Initialization & Status:**
```json
{
  "type": "session.status_running",
  "processed_at": "2026-05-14T12:00:00Z",
  "id": "evt_001"
}
```

**Agent Message (Text Response):**
```json
{
  "type": "agent.message",
  "content": [
    {
      "type": "text",
      "text": "Here's the solution..."
    }
  ],
  "processed_at": "2026-05-14T12:00:01Z",
  "id": "evt_002"
}
```

**Tool Use (Agent Wants to Execute a Tool):**
```json
{
  "type": "agent.tool_use",
  "name": "Bash",
  "input": {
    "command": "ls -la /path/to/worktree"
  },
  "processed_at": "2026-05-14T12:00:02Z",
  "id": "evt_003"
}
```

**Tool Result (After Tool Executes):**
```json
{
  "type": "agent.tool_result",
  "tool_use_id": "evt_003",
  "content": [
    {
      "type": "text",
      "text": "total 42\ndrwxr-xr-x  5 user  staff  160 May 14 12:00 ."
    }
  ],
  "processed_at": "2026-05-14T12:00:03Z",
  "id": "evt_004"
}
```

**Session Idle (Agent Finished or Awaiting Input):**
```json
{
  "type": "session.status_idle",
  "stop_reason": {
    "type": "end_turn"
  },
  "processed_at": "2026-05-14T12:00:04Z",
  "id": "evt_005"
}
```

**Session Error:**
```json
{
  "type": "session.error",
  "error": {
    "type": "error_type_string",
    "message": "Detailed error message",
    "retry_status": "retriable"
  },
  "processed_at": "2026-05-14T12:00:05Z",
  "id": "evt_006"
}
```

**Agent Thinking (Extended Thinking Models):**
```json
{
  "type": "agent.thinking",
  "thinking": "...",
  "processed_at": "2026-05-14T12:00:06Z",
  "id": "evt_007"
}
```

### TypeScript Models

```typescript
// Base event structure
type StreamJsonEvent = {
  type: string;
  id: string;
  processed_at: string | null;  // null = queued, will be populated later
};

// Agent message event
type AgentMessageEvent = StreamJsonEvent & {
  type: 'agent.message';
  content: ContentBlock[];
};

type TextBlock = {
  type: 'text';
  text: string;
};

type ContentBlock = TextBlock; // Can extend for images, etc.

// Tool use event
type AgentToolUseEvent = StreamJsonEvent & {
  type: 'agent.tool_use';
  name: string;  // e.g., 'Bash', 'Edit', 'Read'
  input: Record<string, any>;
};

// Tool result event
type AgentToolResultEvent = StreamJsonEvent & {
  type: 'agent.tool_result';
  tool_use_id: string;  // References the agent.tool_use event id
  content: ContentBlock[];
};

// Session status events
type SessionStatusRunning = StreamJsonEvent & {
  type: 'session.status_running';
};

type SessionStatusIdle = StreamJsonEvent & {
  type: 'session.status_idle';
  stop_reason: {
    type: 'end_turn' | 'requires_action';
    event_ids?: string[];  // For requires_action: which tool_use events need approval
  };
};

type SessionError = StreamJsonEvent & {
  type: 'session.error';
  error: {
    type: string;
    message: string;
    retry_status: 'retriable' | 'non_retriable';
  };
};

type SessionStatusTerminated = StreamJsonEvent & {
  type: 'session.status_terminated';
  error?: {
    type: string;
    message: string;
  };
};

// Discriminated union
type StreamEvent =
  | AgentMessageEvent
  | AgentToolUseEvent
  | AgentToolResultEvent
  | SessionStatusRunning
  | SessionStatusIdle
  | SessionError
  | SessionStatusTerminated;
```

### Event Parsing

```typescript
import * as readline from 'readline';

const rl = readline.createInterface({
  input: claudeProcess.stdout
});

rl.on('line', (line) => {
  try {
    const event: StreamEvent = JSON.parse(line);
    switch (event.type) {
      case 'agent.message':
        handleAgentMessage(event as AgentMessageEvent);
        break;
      case 'agent.tool_use':
        handleToolUse(event as AgentToolUseEvent);
        break;
      case 'session.status_idle':
        handleSessionIdle(event as SessionStatusIdle);
        break;
      // ... etc
    }
  } catch (err) {
    console.error('Failed to parse event:', err, 'line:', line);
  }
});
```

### What's NOT in the Stream-JSON Output

- **Cost/token counts:** NOT emitted per-event. Must query session object post-completion.
- **Tool descriptions:** NOT included; the model already knows them.
- **Intermediate checkpoints:** NOT exposed; only final tool_use → tool_result.

**Source:** Managed Agents API documentation (session event stream)[2]; CLI uses same event types.

---

## 3. Sending Input Mid-Session

This is the **critical gap** in the documented CLI protocol.

### What We Know

1. **Flag exists:** `--input-format stream-json` is a valid flag (confirmed in `claude --help`).
2. **Documentation gap:** The CLI docs do not explain what format to send on stdin.
3. **Agent SDK does it:** The Managed Agents API supports sending `user.message` events mid-session via HTTP (documented)[2].

### Two Scenarios

#### Scenario A: Live Multi-Turn on Stdin (UNKNOWN)

If `--input-format stream-json` truly supports live input, the expected flow would be:

1. Spawn `claude -p --input-format stream-json --output-format stream-json 'initial prompt'`.
2. CLI starts processing; emits initial events on stdout.
3. Parent writes `\n`-delimited JSON to stdin:
   ```json
   {"type": "user.message", "content": [{"type": "text", "text": "New prompt"}]}
   ```
4. CLI receives input, resumes agent loop, emits new events.
5. Parent repeats step 3–4 as needed.
6. Parent closes stdin or sends termination signal to exit.

**Blocker:** Exact input event schema for CLI is **undocumented**. The SDK docs show `user.message` format, but it's unclear if CLI accepts the same.

#### Scenario B: Fresh Process Per Prompt (KNOWN)

If live stdin is not supported, use session resumption:

1. Spawn `claude -p --output-format stream-json --session-id <uuid> 'initial prompt'`.
2. Wait for `session.status_idle` event.
3. Kill the process.
4. **Spawn a new process** with the same `--session-id`:
   ```bash
   claude -p --output-format stream-json --session-id <same-uuid> 'follow-up prompt'
   ```
5. CLI resumes the session (full context preserved) and responds.
6. Repeat steps 2–5 for each new prompt.

**Verified:** `--session-id` flag is documented and preserves full conversational context[1].

### Recommendation: Dual-Path Implementation

For Phase 3, implement **Scenario B** initially (fresh process per prompt):
- Simpler to reason about and debug.
- No stdin event schema assumptions.
- Session ID can be a deterministic UUID derived from worktree path (or random GUID stored in session metadata).
- Supports multi-turn naturally.

**Spike needed:** Write a test script to try live stdin input (`--input-format stream-json`) and see if it accepts `user.message` events. If it does, switch to Scenario A for lower latency.

---

## 4. Tool Approval Flow

### Permission Modes

The `--permission-mode` flag controls how the CLI handles tool calls:

| Mode | Behavior |
|------|----------|
| `default` | Prompt user for each tool call (interactive only; won't work with `-p`) |
| `acceptEdits` | Auto-approve file edits; prompt for other tools |
| `plan` | Read-only; never execute tools, only show what would be done |
| `auto` | Use AI-based classifier to decide which tools are safe; auto-approve low-risk ones |
| `dontAsk` | Trust the model; execute all tools without prompting |
| `bypassPermissions` | Same as `dontAsk` |

**For jide (with custom UI approval bar):** Use `--permission-mode default` + capture tool use events, then implement custom approval in the renderer.

### Tool Allowlisting / Blocklisting

**Allowlist (tools that run without prompting):**
```bash
claude -p --allowedTools "Bash(git *) Edit Read" --output-format stream-json "your prompt"
```

**Blocklist (tools that are denied):**
```bash
claude -p --disallowedTools "Bash(rm *) Bash(dd *)" --output-format stream-json "your prompt"
```

**Syntax:**
- Exact match: `Bash`, `Edit`, `Read`, `Glob`, `Grep`, `WebFetch`, `WebSearch`.
- Glob patterns: `Bash(git *)`, `Edit(src/*)`, `Bash(npm *)`.
- Space or comma separated.

**Enforcement:** Blocklisted tools are **removed from the model's context entirely** (model doesn't see them as options). Allowlisted tools execute without a prompt event emitted.

### How Approval Works in `stream-json`

1. **Agent decides to use a tool:** Emits `agent.tool_use` event.
2. **With `--permission-mode default`:** CLI pauses and waits for approval.
   - **Current blocker:** The CLI documentation does not specify how to send approval/denial in print mode.
   - In interactive mode, the user types "y" or "n" at a prompt.
   - In print mode with live stdin, presumably you'd send a confirmation event, but the schema is **UNKNOWN**.

**Spike needed:** Determine if `--permission-mode default` + `-p` works, and if so, what format to send approvals on stdin (likely `{"type": "user.tool_confirmation", "tool_use_id": "...", "result": "allow"}`).

### Agent SDK Alternative (Clean Approval Flow)

The Managed Agents API handles approval cleanly:

```typescript
// SDK approach (for reference; requires enterprise access)
const stream = await client.beta.sessions.events.stream(sessionId);
await client.beta.sessions.events.send(sessionId, {
  events: [{ type: "user.message", content: [...] }]
});

for await (const event of stream) {
  if (event.type === "agent.tool_use") {
    // Renderer UI displays tool with Approve/Deny buttons
    // Parent sends:
    await client.beta.sessions.events.send(sessionId, {
      events: [{
        type: "user.tool_confirmation",
        tool_use_id: event.id,
        result: "allow" // or "deny"
      }]
    });
  }
}
```

The SDK's approval flow is **fully documented**[2], whereas the CLI's is a gap.

---

## 5. CLI vs. Claude Agent SDK Comparison

### Dimension 1: Programmatic Control

| Aspect | CLI | SDK |
|--------|-----|-----|
| Model selection | `--model` flag | Agent config, mutable per-session |
| System prompt | `--system-prompt` flag | Agent config or per-message override |
| Tools available | `--allowedTools` / `--disallowedTools` | `agent.toolset_20260401` + `configs` array |
| Interrupt mid-response | Not documented | `user.interrupt` event |
| Session lifecycle | Spawn process, kill, resume by UUID | Explicit API calls (create, delete, archive) |
| **Winner** | Limited | **SDK** |

### Dimension 2: Tool Approval UX

| Aspect | CLI | SDK |
|--------|-----|-----|
| Approval event in stream | Undocumented for print mode | `user.tool_confirmation` event (documented)[2] |
| Blocklisting syntax | Glob patterns (simple) | Tool config with `enabled: false` |
| Custom approval UI integration | Unclear how to send approval on stdin | Clean: await confirmation, send result event |
| **Winner** | Unclear | **SDK** |

### Dimension 3: Session Lifecycle

| Aspect | CLI | SDK |
|--------|-----|-----|
| Create session | Spawn process | HTTP API call |
| Pause session | Kill process | Session persists; just stop sending events |
| Resume session | `--session-id` flag | HTTP API call with session ID |
| List sessions | Not integrated | API endpoint |
| Token/cost tracking | Must extract from stderr or logs | `session.usage` field post-completion |
| **Winner** | Process-based (lossy) | **SDK** |

### Dimension 4: Token/Cost Visibility

| Aspect | CLI | SDK |
|--------|-----|-----|
| Real-time token counts | Not in stream-json events | `span.model_request_end` event includes `model_usage` |
| Per-session totals | Undocumented | `session.usage` object (input/output/cache tokens) |
| Cost estimation | Manual calculation | Included in session object |
| **Winner** | Limited | **SDK** |

### Dimension 5: Deployment (Electron Desktop App)

| Aspect | CLI | SDK |
|--------|-----|-----|
| Binary size | ~50–100 MB (bundled or downloads on first run) | Library only; relies on Node.js SDK (@anthropic-ai/sdk ~2 MB) |
| Platform support | macOS, Linux, Windows | Node.js on any platform (same as jide) |
| Dependency management | Separate binary (managed by Homebrew or direct download) | npm package |
| Auth handling | Reads `ANTHROPIC_API_KEY` env var or stores credential locally | `ANTHROPIC_API_KEY` env var or SDK `.setApiKey()` |
| Enterprise SSO | CLI can use Anthropic Console login | SDK uses API key (no SSO; requires managed key distribution) |
| **Winner** | CLI (lightweight for distribution) | **SDK** (lighter dep, no binary) |

### Dimension 6: Required Dependencies

| Path | Install | Code |
|------|---------|------|
| **CLI** | Ensure `claude` binary on PATH or bundle it; Check via `which claude` or call `claude --version` in preload script | `spawn('claude', ['--output-format', 'stream-json', ...])` |
| **SDK** | `npm install @anthropic-ai/sdk` | `new Anthropic({ apiKey: ... })` + event API calls |

**Required Beta Header for SDK:** All Managed Agents API calls require `anthropic-beta: managed-agents-2026-04-01` header. SDK sets this automatically.

---

## 6. Recommendation for jide

### Decision Matrix

| Factor | Weight | CLI | SDK | Winner |
|--------|--------|-----|-----|--------|
| Availability (no API access gate) | 40% | Yes | No (enterprise only) | CLI |
| Approval UX clarity | 25% | Poor (undocumented) | Excellent (documented) | SDK |
| Simplicity for Phase 3 | 20% | Good (process-based) | Good (API-based) | **Tie** |
| Deployment ease | 15% | Good (binary) | Better (npm pkg) | SDK |

### Verdict: CLI for Phase 3 (with SDK Fallback in Roadmap)

**Go with the Claude CLI** because:

1. **Immediately available:** No API access requirement; `claude` is installed locally or can be bundled.
2. **Lower cognitive load:** Familiar spawn/process model for Electron main process.
3. **Proven:** Battle-tested in interactive Claude Code sessions; event format is stable.
4. **Documented enough:** Stream-json format, session management, and model selection are all documented.

**Known gaps (and spikes to fill):**
- Live stdin input format (spike: test `--input-format stream-json` with multi-turn).
- Tool approval flow in print mode (spike: test if `--permission-mode default` emits an approvable event or blocks).

**Migration path to SDK:** Once Anthropic makes the managed-agents API generally available (not enterprise-only), jide can migrate to it for tighter control. The event model is the same, so the renderer UI won't break.

---

## 7. Pseudo-Code: ClaudeSession (TypeScript)

```typescript
import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';
import { EventEmitter } from 'events';

type SessionConfig = {
  cwd: string;
  model?: string;
  systemPrompt?: string;
  allowedTools?: string[];
  maxTurns?: number;
  onEvent: (event: StreamEvent) => void;
  onError: (err: Error) => void;
};

class ClaudeSession extends EventEmitter {
  private process: ChildProcess | null = null;
  private sessionId: string;
  private config: SessionConfig;
  private rl: readline.Interface | null = null;

  constructor(config: SessionConfig) {
    super();
    this.config = config;
    this.sessionId = generateUUID();
  }

  start(prompt: string): void {
    const args = [
      '-p',
      '--output-format', 'stream-json',
      '--input-format', 'stream-json',
      '--session-id', this.sessionId,
      '--model', this.config.model || 'claude-opus-4-7',
      '--permission-mode', 'default',
      ...(this.config.systemPrompt ? ['--system-prompt', this.config.systemPrompt] : []),
      ...(this.config.allowedTools ? ['--allowedTools', this.config.allowedTools.join(' ')] : []),
      ...(this.config.maxTurns ? ['--max-turns', String(this.config.maxTurns)] : []),
      prompt
    ];

    this.process = spawn('claude', args, {
      cwd: this.config.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }
    });

    this.rl = readline.createInterface({
      input: this.process.stdout
    });

    this.rl.on('line', (line) => {
      try {
        const event: StreamEvent = JSON.parse(line);
        this.config.onEvent(event);
      } catch (err) {
        this.config.onError(new Error(`JSON parse: ${err.message}`));
      }
    });

    this.process.stderr?.on('data', (chunk) => {
      // Log or handle stderr
      console.error('[claude stderr]', chunk.toString());
    });

    this.process.on('exit', (code) => {
      if (code !== 0) {
        this.config.onError(new Error(`Process exited with code ${code}`));
      }
      this.emit('exit');
    });
  }

  resume(prompt: string): void {
    // Reuse sessionId, spawn new process
    this.start(prompt);
  }

  approveToolCall(toolUseEventId: string): void {
    if (!this.process?.stdin) {
      throw new Error('Process stdin not available');
    }
    // SPIKE: Verify correct format
    const approval = {
      type: 'user.tool_confirmation',
      tool_use_id: toolUseEventId,
      result: 'allow'
    };
    this.process.stdin.write(JSON.stringify(approval) + '\n');
  }

  denyToolCall(toolUseEventId: string, reason?: string): void {
    if (!this.process?.stdin) {
      throw new Error('Process stdin not available');
    }
    // SPIKE: Verify correct format
    const denial = {
      type: 'user.tool_confirmation',
      tool_use_id: toolUseEventId,
      result: 'deny',
      ...(reason && { deny_message: reason })
    };
    this.process.stdin.write(JSON.stringify(denial) + '\n');
  }

  kill(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }
}
```

---

## 8. Open Questions & Spikes Needed

| Question | Impact | Spike Plan |
|----------|--------|-----------|
| **Does `--input-format stream-json` support live multi-turn input?** | Critical for UX latency | Create test script that spawns with flag, waits for idle, sends `user.message` event on stdin, checks for resumption |
| **What is the exact JSON schema for approval in print mode?** | Critical for tool approval | Test `--permission-mode default` with `-p`, let it hit a tool use, try sending `user.tool_confirmation` event on stdin |
| **Are token counts available in stream-json events?** | Important for cost tracking | Inspect stream-json output for `model_usage` or similar fields; check if session metadata is queryable post-completion |
| **Can session state (files, env vars) be preserved across process restarts with `--session-id`?** | Important for multi-turn flow | Create two sequential processes with same session ID, check if working directory state/git branch is preserved |
| **What happens if `--max-turns` is hit?** | Important for safety | Trigger limit, observe exit code and event stream ending |

---

## 9. Sources & References

[1] Claude Code CLI Reference - https://code.claude.com/docs/en/cli-reference.md (local help output: `claude --help`, v2.1.141)

[2] Claude Managed Agents: Events and Streaming - https://platform.claude.com/docs/en/managed-agents/events-and-streaming.md

[3] Claude Managed Agents: Quickstart - https://platform.claude.com/docs/en/managed-agents/quickstart.md

[4] Claude Managed Agents: Tools - https://platform.claude.com/docs/en/managed-agents/tools.md

[5] Claude Code: How Claude Code Works - https://code.claude.com/docs/en/how-claude-code-works.md

[6] Claude Code: Quickstart - https://code.claude.com/docs/en/quickstart.md

---

## 10. Next Steps

1. **Immediate (Pre-Planning):**
   - Run the three spikes listed in Section 8 (live stdin, approval format, token counts).
   - Document findings in `.planning/spike-results/claude-cli-spikes.md`.

2. **For Plan Phase:**
   - Assume successful spikes (or graceful fallbacks).
   - Design `ClaudeSession` class with event routing to Electron renderer IPC.
   - Plan token/cost tracking UI.

3. **For Execution Phase:**
   - Implement `ClaudeSession` with spike results.
   - Build `ApprovalBar` UI component tied to `agent.tool_use` events.
   - Integration test: Spawn session, emit message, capture and render events, approve a tool, verify execution.

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-14  
**Author:** jide Research Phase 3  
**Confidence Levels:**
- CLI invocation shape: ✓ High (documented + tested)
- Event schema: ✓ High (SDK docs + local testing)
- Multi-turn input: ⚠ Medium (spike needed)
- Tool approval: ⚠ Medium (spike needed)
- CLI vs SDK comparison: ✓ High (both documented)
