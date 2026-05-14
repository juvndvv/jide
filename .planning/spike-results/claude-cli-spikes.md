# Claude CLI runtime spike — findings

**Date:** 2026-05-14
**CLI version:** `2.1.141 (Claude Code)`
**Auth:** Workspace session (`apiKeySource: "none"` in the `system/init` event — i.e. no `ANTHROPIC_API_KEY` env var, the CLI authenticates via its own keychain-based session)
**Cost incurred:** ~$0.245 across 5 invocations (4 scenarios + live-stdin probe). Each invocation pays for a fresh `ephemeral_1h` cache creation of ~71k system-prompt tokens.

## How the spike was run

- `tests/spike/capture-claude-events.mjs` — main capture script, four scenarios.
- `tests/spike/probe-live-stdin.mjs` — Scenario A probe (multi-turn over a single live stdin pipe).
- Fixtures in `tests/fixtures/claude-events/*.ndjson`.
- Logs in `.planning/spike-results/capture.log` and `probe-live-stdin.log`.

The CLI rejects `-p --output-format stream-json` unless `--verbose` is also passed (`Error: When using --print, --output-format=stream-json requires --verbose`). The capture script was updated to include `--verbose`.

## Event types observed

| Scenario | Event types (in stream order, dedup) | Exit | Notes |
|---|---|---|---|
| `simple-text` | `system(hook_started ×4 → hook_response ×4 → init)` → `assistant(thinking)` → `assistant(text)` → `rate_limit_event` → `result(success)` | 0 | Baseline. No `stream_event` because `--include-partial-messages` was not set. |
| `with-tool-use` | … `init` → `assistant(thinking)` → `assistant(tool_use Bash pwd)` → `rate_limit_event` → `user(tool_result)` → `assistant(thinking)` → `assistant(text)` → `result(success)` | 0 | Single tool round-trip auto-executed under `bypassPermissions`. |
| `with-approval` | … `init` → `assistant(thinking)` → `assistant(tool_use Bash "ls -la")` → `user(tool_result)` → `assistant(thinking)` → `assistant(text)` → `rate_limit_event` → `result(success)` | 0 | **Tool executed without any approval round-trip even under `--permission-mode default`.** See approval section. |
| `error` | … `init` → `assistant(text)` (synthetic) → `result(success, is_error: true, api_error_status: 404)` | 1 | The `assistant` event carries `error: "invalid_request"` and `message.model: "<synthetic>"`. The `result` flips `is_error: true` even though `subtype` stays `"success"`. |
| `live-stdin-probe` | First turn: `system(init,status)` → many `stream_event` → `assistant(thinking,text)` → `result`. Second turn (sent via stdin 8 s later): `system(init,status)` → `stream_event` → `assistant(thinking,text)` → `result`. | 0 | Live multi-turn over the same stdin pipe works — see Scenario A section. |

### Notes on field names vs. the research doc

| Research doc said | Reality |
|---|---|
| `type: 'agent.message'`, `'agent.tool_use'`, `'user.tool_confirmation'` | Real types are flat: `assistant`, `user`, `system`, `result`, `rate_limit_event`, `stream_event`. Inner block types match the Anthropic Messages API (`text`, `thinking`, `tool_use`, `tool_result`). |
| `content: [{type:'text', text:...}]` on a top-level event | Lives at `event.message.content` (the event wraps a standard Anthropic message). |
| `user.message` for live stdin | Real shape is `{ "type": "user", "message": { "role": "user", "content": [{ "type": "text", "text": "..." }] } }`. |
| Single emitted "message" event | The CLI emits a separate `assistant` event per content block (one for `thinking`, one for `tool_use`, one for `text`), each carrying the **full cumulative message so far** with the same `message.id` and different `uuid`. Consumers must dedup by `(message.id, content[i].type)` rather than concatenate. |
| Hooks emitted before tool dispatch only | Hooks appear at session start as `system{subtype:"hook_started"|"hook_response", hook_name:"SessionStart:startup"}`. Each hook produces a started/response pair. Four hooks fire on every invocation in this environment (superpowers, warp, etc.). The protocol parser must tolerate and skip these. |

## Concrete event shapes

Each block below is **verbatim** from the captured `.ndjson` files (large hook-output blobs trimmed with `…` for readability).

### `system` / `subtype: hook_started` and `hook_response`

```json
{"type":"system","subtype":"hook_started","hook_id":"f7b036b2-…","hook_name":"SessionStart:startup","hook_event":"SessionStart","uuid":"cad59ca2-…","session_id":"7623b64c-…"}
```

```json
{"type":"system","subtype":"hook_response","hook_id":"f7b036b2-…","hook_name":"SessionStart:startup","hook_event":"SessionStart","output":"","stdout":"","stderr":"","exit_code":0,"outcome":"success","uuid":"561e97c7-…","session_id":"7623b64c-…"}
```

Fields: `hook_id` correlates `started` with `response`; `outcome ∈ {"success", …}`; `output/stdout/stderr` may contain large blobs.

### `system` / `subtype: init`

```json
{
  "type": "system",
  "subtype": "init",
  "cwd": "/Users/jotadev/dev/jotadev/jide",
  "session_id": "7623b64c-e118-4b42-835d-fd431c4d34cd",
  "tools": ["Task","AskUserQuestion","Bash","…"],
  "mcp_servers": [{"name":"pencil","status":"connected"}, …],
  "model": "claude-haiku-4-5-20251001",
  "permissionMode": "bypassPermissions",
  "slash_commands": [...],
  "apiKeySource": "none",
  "claude_code_version": "2.1.141",
  "output_style": "default",
  "agents": [...],
  "skills": [...],
  "plugins": [...],
  "analytics_disabled": false,
  "uuid": "9c03ec97-…",
  "memory_paths": { "auto": "/Users/jotadev/.claude/projects/-Users-jotadev-dev-jotadev-jide/memory/" },
  "fast_mode_state": "off"
}
```

Fields of interest for jide: `session_id` (use for resume), `cwd`, `model` (resolved to full versioned name even when we passed `haiku`), `permissionMode`, `apiKeySource`, `claude_code_version`. This event is the **canonical "session ready" signal** — emit it from the main process to renderers as the start of the session.

### `system` / `subtype: status`

```json
{"type":"system","subtype":"status","status":"requesting","uuid":"d5fd8426-…","session_id":"d96710c3-…"}
```

Only seen in the live-stdin probe. Likely emitted once per request lifecycle when `--input-format stream-json` is active. `status` value seen: `"requesting"`. Useful for UI affordances (spinner).

### `assistant` (cumulative message envelope, one per content block)

```json
{
  "type": "assistant",
  "message": {
    "model": "claude-haiku-4-5-20251001",
    "id": "msg_017anrqRbHGTgVgBPnGmp3Ch",
    "type": "message",
    "role": "assistant",
    "content": [{"type":"thinking","thinking":"…","signature":"…"}],
    "stop_reason": null,
    "usage": { "input_tokens": 10, "cache_creation_input_tokens": 71443, "cache_read_input_tokens": 0, "output_tokens": 7, … }
  },
  "parent_tool_use_id": null,
  "session_id": "7623b64c-…",
  "uuid": "2af147d7-…"
}
```

Then a sibling event with the **same `message.id`** carrying both the thinking and the next block:

```json
{ "type":"assistant", "message": { "id":"msg_017anrqRbHGTgVgBPnGmp3Ch", "content": [{"type":"text","text":"Hello, let's build something great."}], … }, "uuid":"ebf53608-…", "session_id":"7623b64c-…" }
```

Fields: `message.content[i].type ∈ {"thinking", "text", "tool_use"}`. Each emission **may** show a single new block (post-trim) or the full cumulative array — both shapes are present in the captures, so consumers should always look at `content` as authoritative for the current state and key on `(message.id, content[i].type)`.

### `assistant` with `tool_use`

```json
{"type":"tool_use","id":"toolu_01V6PdMKCMN51T46CJG7Z4JY","name":"Bash","input":{"command":"pwd","description":"Get current working directory"},"caller":{"type":"direct"}}
```

The `id` (`toolu_*`) is what `user.tool_result` correlates against. `caller.type` distinguishes `"direct"` from sub-agent invocations (not seen here).

### `user` with `tool_result`

```json
{
  "type": "user",
  "message": { "role": "user", "content": [{
    "tool_use_id": "toolu_01V6PdMKCMN51T46CJG7Z4JY",
    "type": "tool_result",
    "content": "/Users/jotadev/dev/jotadev/jide",
    "is_error": false
  }]},
  "parent_tool_use_id": null,
  "session_id": "9c4766f0-…",
  "uuid": "9b5b9ca2-…",
  "timestamp": "2026-05-14T10:49:25.002Z",
  "tool_use_result": {
    "stdout": "/Users/jotadev/dev/jotadev/jide",
    "stderr": "",
    "interrupted": false,
    "isImage": false,
    "noOutputExpected": false
  }
}
```

Fields: the top-level `tool_use_result` (note: **outside** `message`) is a CLI-specific augmentation with `stdout`/`stderr`/`interrupted`/`isImage` for richer rendering. The `message.content[0]` is the Anthropic-shaped `tool_result` block that gets fed back to the model.

### `rate_limit_event`

```json
{
  "type": "rate_limit_event",
  "rate_limit_info": {
    "status": "allowed_warning",
    "resetsAt": 1779033600,
    "rateLimitType": "seven_day",
    "utilization": 0.82,
    "isUsingOverage": false,
    "surpassedThreshold": 0.75
  },
  "uuid": "08f143c3-…",
  "session_id": "7623b64c-…"
}
```

Fields: `status` (e.g. `"allowed_warning"`), `rateLimitType` (e.g. `"seven_day"`), `utilization` (0..1), `resetsAt` (unix seconds), `surpassedThreshold`. jide should surface this to the user before they hit the wall.

### `stream_event` (only with `--include-partial-messages`)

```json
{"type":"stream_event","event":{"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"A."}},"session_id":"d96710c3-…","parent_tool_use_id":null,"uuid":"c1a8b436-…"}
```

Inner `event.type` values observed: `message_start`, `content_block_start`, `content_block_delta`, `content_block_stop`, `message_delta`, `message_stop`. Inner `delta.type` values: `text_delta`, `thinking_delta`, `signature_delta`. This is the raw Anthropic SSE-style streaming — useful for typewriter UX but redundant with the cumulative `assistant` events. **For Phase 3 we should NOT enable `--include-partial-messages` initially**; the per-block `assistant` events are enough for the MVP and avoid the dedup complexity.

### `result`

```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "api_error_status": null,
  "duration_ms": 7226,
  "duration_api_ms": 6755,
  "num_turns": 1,
  "result": "Hello, let's build something great.",
  "stop_reason": "end_turn",
  "session_id": "7623b64c-…",
  "total_cost_usd": 0.09132375,
  "usage": { … },
  "modelUsage": { "claude-haiku-4-5-20251001": { "inputTokens": 10, "outputTokens": 402, "costUSD": 0.09132375, … } },
  "permission_denials": [],
  "terminal_reason": "completed",
  "fast_mode_state": "off",
  "uuid": "8ef6df5c-…"
}
```

For errors (`error` scenario):

```json
{ "type":"result", "subtype":"success", "is_error": true, "api_error_status": 404, "duration_ms": 679, "result":"There's an issue with the selected model …", "stop_reason":"stop_sequence", "permission_denials":[], "terminal_reason":"completed", … }
```

Key fields: `is_error` (boolean), `api_error_status` (number|null), `permission_denials` (array — empty here but the field exists for future approval-denial wiring), `terminal_reason` (`"completed"` so far).

## Multi-turn input (Scenario A vs B)

**Live stdin works.** The `probe-live-stdin.mjs` script:

1. Spawned `claude -p --verbose --output-format stream-json --input-format stream-json --include-partial-messages --model haiku --permission-mode bypassPermissions` with no positional prompt.
2. Wrote `{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Say A."}]}}\n` to stdin immediately.
3. Observed full event flow culminating in `result(success)` with `"A."` content.
4. After 8 s, wrote a second `{"type":"user", …, "text":"Now say B."}` line.
5. Observed a **new** `system{subtype:"init"}` event (so each turn resets `init`), then full event flow ending in `result(success)` with `"B."` content.
6. Closed stdin after 16 s; the process exited 0.

- [x] **Live stdin works** — second prompt produced additional events.
- [ ] Live stdin partially works.
- [ ] Live stdin not supported.

**Decision: use Scenario A** (one long-lived process per session, prompts pushed over the live stdin pipe). It is dramatically simpler than Scenario B (fresh process + `--session-id` per turn) because:

- No need to persist `session_id` across processes.
- No re-pay of the 71k-token system-prompt cache on every turn (each new process pays it again — see costs above).
- The CLI is happy with successive `user` messages.

The only caveat: each new turn emits a fresh `system{subtype:"init"}` event. jide's session reducer should treat init events idempotently after the first one (re-use the existing `session_id`) and use them only as a "turn boundary" signal.

## Approval flow

What did the CLI do for the `with-approval` scenario (`--permission-mode default` with `-p`)?

- [ ] Refused to run any tools (no `tool_use` event).
- [ ] Emitted a `tool_use` event then blocked.
- [ ] Emitted a `tool_use` event and waited for stdin confirmation.
- [x] **Auto-allowed the Bash `ls -la` and ran it without any approval round-trip.**

Concrete trace: `assistant(thinking) → assistant(tool_use Bash "ls -la") → user(tool_result with full ls output) → assistant(thinking) → assistant(text)`. No `permission_request`-style event, no stdin pause, `result.permission_denials = []`.

This is almost certainly because the CLI consulted **per-project settings** in `~/.claude/projects/-Users-jotadev-dev-jotadev-jide/` (note `memory_paths.auto` in `system/init`). The user has previously approved `Bash` for this cwd in their interactive sessions, so `default` allows it.

**Implication for jide**: in `-p` mode the CLI's `default` permission mode is unreliable for our UX — it depends on opaque per-project state we don't control. To get a deterministic approval round-trip we would need to either (a) use a permission-prompt MCP tool / external approval callback, or (b) enforce approvals entirely on the jide side (parse `tool_use` events, hold them in a pending state, kill or restart the session to deny, send a tool_result early to satisfy).

Neither is needed for the Phase 3 MVP. **Recommendation: ship Phase 3 with `--permission-mode bypassPermissions` and an allowlist/blocklist enforced inside jide by inspecting `tool_use` events before forwarding them to renderers and by selectively killing the session for forbidden tools.** This matches how Phase 3's UX is framed (user has already chosen which worktree the agent operates in, and the tool gating is a future-phase concern).

## Decisions for Phase 3 implementation

- **Sending prompts:** Scenario A — single long-lived `claude` child process per session, prompts written as `{"type":"user","message":{"role":"user","content":[{"type":"text","text":"…"}]}}\n` lines on its stdin.
- **Approval:** `--permission-mode bypassPermissions` for the MVP. Track `tool_use` events for display and future gating, but do not block on them.
- **`--permission-mode` for Phase 3:** `bypassPermissions`.
- **`--output-format`:** `stream-json` with `--verbose`. Do **not** set `--include-partial-messages` in the MVP — the per-block `assistant` events are sufficient.
- **`--input-format`:** `stream-json` (required for Scenario A).
- **Model:** allow user to choose; default to `haiku` for the early MVP to keep cost low.
- **Hook noise:** the parser must tolerate up to N `system{subtype:"hook_*"}` events at session start. Treat them as opaque diagnostics, not session-state.
- **`system{subtype:"init"}`:** treat as turn boundary, not session start, after the first one (it re-fires on every turn under `--input-format stream-json`).

## What changes vs the research doc

1. **Event types are flat strings**, not dotted (`assistant`, not `agent.message`; `user`, not `user.tool_result`).
2. **Inner content uses Anthropic Messages API shapes** (`text`, `thinking`, `tool_use`, `tool_result`) inside `event.message.content`. The research doc's hypothetical `agent.tool_use` is wrong; the real shape is `assistant` with `message.content[i].type === "tool_use"`.
3. **Live stdin user message shape** is `{"type":"user","message":{"role":"user","content":[…]}}`, not `{"type":"user.message","content":[…]}`.
4. **`--verbose` is mandatory** with `-p --output-format stream-json` (the research doc omitted this).
5. **`default` permission mode in `-p` is not deterministic** — it consults per-project saved approvals. The research doc treated `default` as "request confirmation for every tool"; in practice it can auto-allow silently.
6. **`rate_limit_event`** is a real event type not mentioned in the research doc. Worth handling in the UI.
7. **`stream_event`** appears with `--include-partial-messages` and gives raw SSE-style deltas. The research doc didn't anticipate the duplication with `assistant` events.
8. **`assistant` events are emitted per content block, cumulative** — consumers must reconcile by `message.id`.
9. The CLI emits a fresh `system{subtype:"init"}` at the start of every turn under `--input-format stream-json`, not only at session start.
10. **Each new `claude -p` process pays a ~71k-token cache-creation tax** (system prompt + tool descriptions). This is the strongest reason to prefer Scenario A.

## Next steps

The captured `.ndjson` fixtures power:

- `src/main/claude/protocol.ts` parser tests (Task 4) — drive with `simple-text`, `with-tool-use`, `with-approval`, `error`, and `live-stdin-probe` fixtures.
- `tests/fixtures/fake-claude.mjs` script library (Task 3) — replay the NDJSON to stdout to simulate a real CLI without spending tokens.
- Task 2's TypeScript event union types should be derived from the verbatim shapes in this document, **not** from the research doc's `agent.*` predictions.
