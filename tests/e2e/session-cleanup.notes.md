# Session subprocess cleanup — structural guarantee

The Phase 3 DoD requires: _"closing the app while sessions are active kills them
cleanly (no zombies)"_. This guarantee is structural — it lives in three
independent layers of the main process — rather than asserted by a runtime E2E
test. This note documents WHY runtime E2E is fragile here and HOW to verify
manually.

## Why no runtime E2E

To assert the absence of zombies after `app.quit()`, an E2E test would need to:

1. Capture the PID of the fake-claude child spawned by `ClaudeSession`.
2. Close the Electron app and the Playwright connection.
3. Poll `process.kill(pid, 0)` from the host until it throws `ESRCH`.

Step 1 is the fragile one. The child PID is owned by the main process and
nothing exposes it over IPC by design — leaking PIDs to the renderer would be a
sandbox escape vector. Wiring a debug-only IPC just for this assertion would
add production code whose only consumer is one test. Step 3 is also racy on CI
runners where the OS may reuse PIDs aggressively.

## Where the guarantee lives

Three independent layers, any one of which is sufficient:

1. **`app.on('before-quit')` → `manager.killAll()`** (`src/main/ipc/sessions.ts`).
   Iterates every active session and calls `kill()` synchronously before Electron
   tears down the main process.

2. **`ClaudeSession.kill()` — SIGTERM with a 3s SIGKILL escalation**
   (`src/main/claude/session.ts`). If the child ignores SIGTERM (e.g. a wedged
   tool call), the timer fires and sends SIGKILL. The escalation timer is
   `unref()`'d so it cannot keep the main process alive past quit.

3. **Per-session `process.on('exit')` guard**
   (`src/main/claude/session.ts`, commit `7910e10`). Even if the main process
   crashes _before_ `before-quit` runs — uncaught exception, segfault,
   `kill -9` from the OS — Node fires `process.on('exit')` and the registered
   listener `SIGKILL`s the child synchronously. This is the last-resort safety
   net for zombies.

The combination of (1) for graceful quits, (2) for stubborn children, and (3)
for catastrophic main-process failure means a zombie `claude` subprocess
requires a kernel-level failure (OOM killer hitting Node before any signal
handler runs) — not something we can reproduce in CI.

## Manual verification

Against fake-claude (deterministic, no network):

```bash
# Terminal 1 — launch dev mode with a script that blocks on stdin forever.
JIDE_FAKE_CLAUDE_SCRIPT=tests/fixtures/claude-events/with-stdin-followup.script.json \
  pnpm dev

# In the app: select a worktree, send any prompt, wait for the first response,
# then send a follow-up so fake-claude is parked at the echo-stdin step.

# Terminal 2 — confirm the child is alive while jide is running.
ps -ax | grep -E 'fake-claude|node.*fake-claude' | grep -v grep

# Quit jide normally (Cmd+Q) or kill -9 the Electron main PID.
# Re-run the ps command — must return no rows.
```

The two existing E2E tests in `tests/e2e/session.spec.ts` cover the in-process
lifecycle (spawn → stream → kill button → exited status), which is the part
that benefits from automation. The cross-process cleanup is verified manually
per release.
