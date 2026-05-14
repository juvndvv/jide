# Fase 3 — Sesión Claude end-to-end (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un worktree puede tener una sesión Claude funcionando real. El usuario selecciona un worktree en la Sidebar (heredado de Fase 2) → escribe un prompt en el composer → ve la respuesta streaming en pantalla → puede aprobar/rechazar tool calls → puede matar la sesión. **Una sola sesión por worktree** — multi-sesión llega en Fase 4.

**Architecture:** El main process es el host: spawnea el CLI `claude` con `child_process.spawn`, parsea el output `stream-json` (NDJSON) línea a línea via `readline`, y reenvía eventos al renderer vía el patrón de push events ya establecido en Fase 2 (`sessions:event`). El renderer es puro UI: subscribe al stream, renderiza mensajes tipados, y reenvía prompts/approvals al main vía IPC request/response.

Una sola clase clave: `ClaudeSession` (EventEmitter) maneja el lifecycle de un proceso `claude`. El `SessionManager` mantiene `Map<wtId, ClaudeSession>` — Phase 3 garantiza N=1 por worktree, pero la estructura ya admite N para Fase 4 sin refactor.

**Tests son deterministas y no consumen tokens de la API.** Toda la suite usa `tests/fixtures/fake-claude.mjs` — un CLI Node que emite secuencias de eventos pregrabadas. **Ningún test invoca a `claude` real.** El runtime spike (Task 1) captura los payloads reales una sola vez y los guarda como fixtures.

**Tech Stack añadido:** Nada nuevo. `child_process.spawn` + `readline` son stdlib de Node. La validación runtime de los eventos parseados se puede hacer con discriminated unions de TypeScript (sin `zod`).

**Dependencia crítica:** El spike (Task 1) **bloquea** Tasks 4+. Tasks 2 (types) y 3 (fake-claude) son spike-independientes y pueden empezar en paralelo si se quiere. Pero si el spike revela un protocolo distinto al asumido por el doc de research, los fixtures de Task 3 hay que reescribirlos.

---

## Research insumo

Lectura obligatoria antes de empezar: `.planning/research/claude-cli-protocol.md`.

Confianza por sección (resumen del doc):

| Área | Confianza | Acción en este plan |
|---|---|---|
| Flags CLI | Alta — verificados contra `claude --help` v2.1.141 | Usar tal cual. **Excepción**: `--max-turns` NO existe — eliminado de cualquier path. |
| Event schema | Media — extrapolada del Managed Agents API | Task 1 captura el shape real; Task 2 define los types contra eso. |
| Live stdin (`--input-format stream-json`) | UNKNOWN | Task 1 decide Escenario A (live stdin) vs B (fresh process por prompt). |
| Tool approval en print mode | UNKNOWN | Task 1 decide cómo se envía Approve/Reject — si sólo es viable via interactive hook, plan se ajusta. |
| Recomendación CLI vs SDK | Alta — CLI gana por disponibilidad inmediata | Plan asume CLI. Migración a SDK queda para post-Fase 9. |

---

## File structure (final, end-of-phase)

```
jide/
├── src/
│   ├── main/
│   │   ├── claude/
│   │   │   ├── session.ts                # ClaudeSession (EventEmitter): spawn/send/kill
│   │   │   ├── protocol.ts               # NDJSON parser → discriminated Event union
│   │   │   ├── manager.ts                # SessionManager: Map<wtId, ClaudeSession[]>
│   │   │   └── locator.ts                # find `claude` binary (PATH or bundled)
│   │   ├── ipc/
│   │   │   └── sessions.ts               # canales sessions:* + sendEvent('sessions:event', …)
│   │   └── index.ts                      # +inyecta SessionManager en IpcDeps
│   ├── preload/
│   │   └── index.ts                      # +window.jide.sessions.{start,send,kill}
│   ├── renderer/src/
│   │   ├── components/
│   │   │   ├── Chat/
│   │   │   │   ├── ChatPanel.tsx
│   │   │   │   ├── Message.tsx           # router por tipo discriminado
│   │   │   │   ├── UserMessage.tsx
│   │   │   │   ├── ClaudeMessage.tsx
│   │   │   │   ├── ToolMessage.tsx       # collapsible card
│   │   │   │   ├── DiffMessage.tsx       # +/- coloring
│   │   │   │   ├── SystemMessage.tsx
│   │   │   │   ├── StreamingIndicator.tsx
│   │   │   │   ├── ApprovalBar.tsx       # awaiting → approve/reject
│   │   │   │   └── Composer.tsx
│   │   │   └── icons/
│   │   │       └── JIcon.tsx             # +nuevos iconos: send, check, x, terminal, file-text
│   │   ├── shortcuts/
│   │   │   └── useSession.ts             # subscribe + send/kill for the active worktree
│   │   └── App.tsx                       # placeholder center → ChatPanel(activeWorktree)
│   └── shared/
│       ├── session.ts                    # Message (discriminated union), Session, SessionStatus
│       └── ipc.ts                        # +CHANNELS sessions:*, +EVENT sessions:event
└── tests/
    ├── fixtures/
    │   ├── fake-claude.mjs               # Node CLI que emite event sequences pregrabadas
    │   └── claude-events/                # JSON files capturados por el spike
    │       ├── simple-text.ndjson
    │       ├── with-tool-use.ndjson
    │       ├── with-approval.ndjson
    │       └── error.ndjson
    ├── unit/
    │   ├── shared/
    │   │   └── session.test.ts           # drift guard
    │   ├── main/
    │   │   ├── claude/
    │   │   │   ├── protocol.test.ts      # parser sobre fixtures
    │   │   │   ├── session.test.ts       # ClaudeSession con fake-claude
    │   │   │   └── manager.test.ts       # 1-per-worktree + roll-up
    │   │   └── ipc/
    │   │       └── sessions.test.ts      # canal sessions:start unitario (opcional)
    │   └── helpers/
    │       └── fake-claude-runner.ts     # spawn fake-claude.mjs con un guion
    └── e2e/
        └── session.spec.ts               # full flow: select worktree → send prompt → see response → approve tool
```

**Responsabilidades clave:**

- `src/main/claude/locator.ts` — único módulo que decide DÓNDE está el binario `claude`. `which claude` → PATH; en futuro empaquetado, fallback a binario bundled. Aislar aquí evita que las pruebas tengan que mockear `spawn`.
- `src/main/claude/protocol.ts` — parser puro y testeable contra fixtures. **No tiene I/O.**
- `src/main/claude/session.ts` — `EventEmitter` con eventos `event` (uno por mensaje parseado) y `exit`. No conoce IPC. Componible.
- `src/main/claude/manager.ts` — fuente única de verdad sobre qué sesiones existen. Phase 3 enforcea N=1; Phase 4 sube el límite cambiando una constante.
- `src/main/ipc/sessions.ts` — adapta `ClaudeSession` events → `sendEvent('sessions:event', …)` para todos los renderers.
- `tests/fixtures/fake-claude.mjs` — el corazón del sistema de tests. Lee un argumento `--script <path>` con un JSON que dice "emit estos N eventos con estos delays, sleep entre cada uno". El test elige el guión.

---

## Conventional Commits — recordatorio

Todos los commits siguen la convención del repo (ver `~/.claude/CLAUDE.md`):

```
type(scope): short description in imperative mood

Optional body explaining the why (English).

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
```

No `Co-Authored-By`. No `Task:` trailer (rama sin ID Asana — `feat/fase-3-sesion-claude` o equivalente).

---

## Task 1: Runtime spike — captura event payloads reales

**Files:**
- Create: `tests/spike/capture-claude-events.mjs` (script, no test)
- Create: `tests/fixtures/claude-events/*.ndjson` (4 archivos: simple-text, with-tool-use, with-approval, error)
- Create: `.planning/spike-results/claude-cli-spikes.md`

> **Pre-condición:** El usuario tiene `claude` instalado y autenticado (`claude --version` funciona y una invocación de prueba sale limpia). El spike consume tokens de la API — explicar al usuario antes de correrlo.

### Step 1.1: Script de captura

Crea `tests/spike/capture-claude-events.mjs`:

```js
#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../fixtures/claude-events');
mkdirSync(OUT_DIR, { recursive: true });

/**
 * Run a single `claude -p --output-format stream-json` invocation,
 * record all stdout lines into <name>.ndjson, and print the captured
 * event types for the spike doc.
 */
async function capture(name, args, prompt) {
  const outPath = join(OUT_DIR, `${name}.ndjson`);
  const sink = createWriteStream(outPath);
  console.log(`\n=== ${name} ===`);
  console.log(`  args: ${args.join(' ')}`);

  const proc = spawn('claude', args, {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: process.env,
  });

  if (prompt !== undefined) {
    proc.stdin.write(prompt + '\n');
    proc.stdin.end();
  }

  const rl = createInterface({ input: proc.stdout });
  const types = new Set();
  rl.on('line', (line) => {
    sink.write(line + '\n');
    try {
      const evt = JSON.parse(line);
      if (typeof evt.type === 'string') types.add(evt.type);
    } catch {
      /* ignore — capture raw */
    }
  });

  await new Promise((res) => proc.on('exit', res));
  sink.end();
  console.log(`  events captured: ${[...types].sort().join(', ') || '(none)'}`);
  console.log(`  → ${outPath}`);
}

// 1. Simple text response — baseline event flow.
await capture(
  'simple-text',
  ['-p', '--output-format', 'stream-json', '--model', 'haiku', '--permission-mode', 'bypassPermissions', 'Say hello in five words.'],
);

// 2. With a tool use — see how tool_use / tool_result are emitted.
await capture(
  'with-tool-use',
  ['-p', '--output-format', 'stream-json', '--model', 'haiku', '--permission-mode', 'bypassPermissions', 'Run `pwd` and tell me the path. Just one command, then summarize.'],
);

// 3. With approval — this MAY block forever in -p mode if approval requires stdin.
//    Run with a timeout. If it blocks, that itself is the finding.
await capture(
  'with-approval',
  ['-p', '--output-format', 'stream-json', '--input-format', 'stream-json', '--model', 'haiku', '--permission-mode', 'default', 'Run `ls` in this directory.'],
  '', // empty initial — provide via stdin? unclear. Try without first.
);

// 4. Error — invalid model name forces a fast error path.
await capture(
  'error',
  ['-p', '--output-format', 'stream-json', '--model', 'this-model-does-not-exist-xyz', 'hello'],
);

console.log('\nDone. Inspect the .ndjson files and write up findings.');
```

WHY notes (don't paste): we use `--model haiku` to keep cost minimal. `--permission-mode bypassPermissions` for the first two avoids any prompt blocking. The third intentionally hits `default` to see what happens — `claude` may simply refuse to run tools in print mode, or may emit a specific event signaling "awaiting approval". The fourth probes the error path.

### Step 1.2: Hacer el script ejecutable y correrlo

```bash
chmod +x tests/spike/capture-claude-events.mjs
node tests/spike/capture-claude-events.mjs 2>&1 | tee .planning/spike-results/capture.log
```

> Si el usuario no quiere consumir tokens, **escalar y parar** — el plan no puede avanzar sin estos fixtures. Si el spike falla por auth (no `ANTHROPIC_API_KEY` y no logged in), pedir al usuario que se autentique con `claude auth login`.

### Step 1.3: Escribir findings doc

Inspecciona los `.ndjson` capturados y documenta en `.planning/spike-results/claude-cli-spikes.md`:

```markdown
# Claude CLI runtime spike — findings

**Date:** 2026-05-14
**CLI version:** $(claude --version)

## Event types observed

| Scenario | Event types (in order) | Notes |
|---|---|---|
| simple-text | … | … |
| with-tool-use | … | … |
| with-approval | … | What did `default` do under `-p`? |
| error | … | Exit code? Stream emits error event before exit? |

## Concrete event shapes

For each unique event type, paste 1–3 examples from the captured ndjson. Annotate any field that differs from the research doc's predictions.

## Multi-turn input (Scenario A vs B)

… findings from the with-approval run + any additional probe with stdin input …

## Approval flow

… what `claude` does when a tool needs approval in `-p` mode …

## Decisions for Phase 3 implementation

- [ ] Sending prompts: stdin live (Scenario A) | one process per prompt (Scenario B). Recommendation: ___.
- [ ] Approval: stdin event | process won't ask in -p mode | only via interactive hook. Recommendation: ___.
- [ ] `permission-mode` for Phase 3: `default` | `bypassPermissions` | other. Recommendation: ___.

## What changes vs the research doc

… list any event names or field names that differ from `.planning/research/claude-cli-protocol.md` …
```

### Step 1.4: Commit

```bash
git add tests/spike/ tests/fixtures/claude-events/ .planning/spike-results/
git commit -m "$(cat <<'EOF'
docs(research): capture real claude-cli event payloads

Spike script invokes `claude -p --output-format stream-json` against
four canned scenarios (simple-text, with-tool-use, with-approval,
error) and records the stdout NDJSON into tests/fixtures/. The captured
fixtures power the protocol parser unit tests (Task 4) and the
fake-claude.mjs sequences (Task 3) without ever hitting the API again.

The findings doc documents the actual event shapes, the decision
between live-stdin and fresh-process-per-prompt for multi-turn, the
real semantics of --permission-mode default under -p, and any
divergences from the earlier research doc.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 2: Shared types `Message` + `Session`

**Files:**
- Create: `src/shared/session.ts`
- Modify: `src/shared/ipc.ts`
- Modify: `tests/unit/shared/ipc.test.ts`
- Create: `tests/unit/shared/session.test.ts`

### Step 2.1: Definir tipos en `src/shared/session.ts`

Basado en lo que el spike encuentre. Provisional (ajustar tras Task 1):

```ts
export type SessionStatus = 'idle' | 'running' | 'awaiting' | 'error' | 'exited';

/** Stable identifier for a worktree session pair. */
export interface SessionId {
  /** Worktree id (from @shared/project). */
  worktreeId: string;
  /** Stable session UUID, reused across resumes. */
  uuid: string;
}

/**
 * Discriminated union over the message types the chat panel renders.
 * The renderer treats this as opaque ordered history; main builds it
 * from the parsed protocol events.
 */
export type Message =
  | { type: 'user'; id: string; text: string; ts: number }
  | { type: 'claude'; id: string; text: string; ts: number; streaming?: boolean }
  | {
      type: 'tool';
      id: string;
      name: string;
      input: Record<string, unknown>;
      status: 'pending' | 'approved' | 'denied' | 'running' | 'done' | 'error';
      output?: string;
      ts: number;
    }
  | { type: 'diff'; id: string; file: string; lines: DiffLine[]; ts: number }
  | { type: 'system'; id: string; text: string; ts: number };

export interface DiffLine {
  sign: '+' | '-' | ' ';
  text: string;
}

/** Snapshot of a session that the renderer can render directly. */
export interface SessionSnapshot {
  id: SessionId;
  status: SessionStatus;
  model: string;
  messages: Message[];
  awaitingToolUseId: string | null;
}
```

### Step 2.2: Drift guards

Añadir a `tests/unit/shared/session.test.ts`:

```ts
import { describe, it, expectTypeOf } from 'vitest';
import type { Message, SessionStatus, SessionSnapshot, DiffLine } from '@shared/session';

describe('shared/session — type contract', () => {
  it('Message is a closed discriminated union over the 5 expected types', () => {
    type Tags = Message['type'];
    expectTypeOf<Tags>().toEqualTypeOf<'user' | 'claude' | 'tool' | 'diff' | 'system'>();
  });

  it('SessionStatus enumerates idle/running/awaiting/error/exited', () => {
    expectTypeOf<SessionStatus>().toEqualTypeOf<'idle' | 'running' | 'awaiting' | 'error' | 'exited'>();
  });

  it('tool message status covers the full lifecycle', () => {
    type ToolStatus = Extract<Message, { type: 'tool' }>['status'];
    expectTypeOf<ToolStatus>().toEqualTypeOf<'pending' | 'approved' | 'denied' | 'running' | 'done' | 'error'>();
  });

  it('SessionSnapshot.messages is Message[]', () => {
    expectTypeOf<SessionSnapshot['messages']>().toEqualTypeOf<Message[]>();
  });

  it('DiffLine sign is one of + - space', () => {
    expectTypeOf<DiffLine['sign']>().toEqualTypeOf<'+' | '-' | ' '>();
  });
});
```

### Step 2.3: Extender `@shared/ipc` con `sessions:*` y `sessions:event`

Modificar `src/shared/ipc.ts`:

- Añadir a `CHANNELS`: `'sessions:start'`, `'sessions:send'`, `'sessions:kill'`, `'sessions:get'` (latter returns current snapshot for a worktree).
- Añadir a `ChannelMap`:
  ```ts
  'sessions:start': { req: { worktreeId: string }; res: SessionSnapshot };
  'sessions:send': { req: { worktreeId: string; text: string }; res: void };
  'sessions:kill': { req: { worktreeId: string }; res: void };
  'sessions:approve-tool': { req: { worktreeId: string; toolUseId: string; allow: boolean; reason?: string }; res: void };
  'sessions:get': { req: { worktreeId: string }; res: SessionSnapshot | null };
  ```
- Añadir a `EVENTS`: `'sessions:event'`.
- Añadir a `EventMap`:
  ```ts
  'sessions:event': { worktreeId: string; snapshot: SessionSnapshot };
  ```

Ampliar `JideApi`:

```ts
sessions: {
  start: (worktreeId: string) => Promise<SessionSnapshot>;
  send: (worktreeId: string, text: string) => Promise<void>;
  kill: (worktreeId: string) => Promise<void>;
  approveTool: (worktreeId: string, toolUseId: string, allow: boolean, reason?: string) => Promise<void>;
  get: (worktreeId: string) => Promise<SessionSnapshot | null>;
};
```

### Step 2.4: Actualizar el drift-guard test

En `tests/unit/shared/ipc.test.ts`, ampliar la lista esperada de `CHANNELS` y `EVENTS`. Añadir un bloque que asserte:

```ts
it('sessions:event payload carries the full snapshot', () => {
  expectTypeOf<EventPayload<'sessions:event'>>().toEqualTypeOf<{
    worktreeId: string;
    snapshot: SessionSnapshot;
  }>();
});
```

### Step 2.5: Extender preload

Read `src/preload/index.ts`. Añadir el nuevo bloque `sessions`:

```ts
sessions: {
  start: (worktreeId) => ipcRenderer.invoke('sessions:start', { worktreeId }) as Promise<SessionSnapshot>,
  send: (worktreeId, text) => ipcRenderer.invoke('sessions:send', { worktreeId, text }) as Promise<void>,
  kill: (worktreeId) => ipcRenderer.invoke('sessions:kill', { worktreeId }) as Promise<void>,
  approveTool: (worktreeId, toolUseId, allow, reason) =>
    ipcRenderer.invoke('sessions:approve-tool', { worktreeId, toolUseId, allow, reason }) as Promise<void>,
  get: (worktreeId) => ipcRenderer.invoke('sessions:get', { worktreeId }) as Promise<SessionSnapshot | null>,
},
```

### Step 2.6: Verify

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm format:check
```

Expected: el drift guard arde primero, luego pasa al añadir las constantes; los tests de tipos arden hasta que `session.ts` aterriza.

### Step 2.7: Commit

```bash
git add src/shared/session.ts src/shared/ipc.ts src/preload/index.ts tests/unit/shared/
git commit -m "$(cat <<'EOF'
feat(shared): session types and sessions:* IPC surface

Defines @shared/session with a discriminated Message union
(user/claude/tool/diff/system), SessionStatus, and SessionSnapshot.
Extends @shared/ipc with sessions:start/send/kill/approve-tool/get
request/response channels and the sessions:event push channel that
broadcasts SessionSnapshot updates to all renderers.

Preload v3 exposes window.jide.sessions.* alongside the existing
projects/worktrees/settings/ping surface. Main-side handlers and the
ClaudeSession itself arrive in Tasks 5-7; invoking these methods now
rejects at runtime — no renderer code calls them yet.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 3: `fake-claude.mjs` fixture

**Files:**
- Create: `tests/fixtures/fake-claude.mjs`
- Create: `tests/fixtures/claude-events/simple.script.json` (ejemplo)

### Step 3.1: Implementar `tests/fixtures/fake-claude.mjs`

```js
#!/usr/bin/env node
/**
 * Deterministic stand-in for `claude -p --output-format stream-json`.
 *
 * Usage: node fake-claude.mjs --script <path-to-script.json>
 *
 * The script is a JSON array of steps. Each step is one of:
 *
 *   { "kind": "emit", "delayMs": 50, "event": <json object> }
 *     — write `event` (as a single NDJSON line) to stdout after delayMs.
 *
 *   { "kind": "echo-stdin" }
 *     — read one NDJSON line from stdin, parse it, and continue.
 *       Used to test the renderer → main → fake-claude prompt flow.
 *
 *   { "kind": "exit", "code": 0 }
 *     — exit with the given code.
 *
 * The fake-claude.mjs MUST NOT make any network calls and MUST NOT
 * read any environment variables besides the script path. It is the
 * test surface for ClaudeSession in unit and E2E tests.
 */

import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { argv, stdout, stdin, exit } from 'node:process';

function parseArgs() {
  const i = argv.indexOf('--script');
  if (i === -1 || !argv[i + 1]) {
    throw new Error('fake-claude.mjs requires --script <path>');
  }
  return argv[i + 1];
}

async function run() {
  const scriptPath = parseArgs();
  const steps = JSON.parse(readFileSync(scriptPath, 'utf8'));

  const rl = createInterface({ input: stdin });
  const stdinQueue = [];
  let stdinResolver = null;
  rl.on('line', (line) => {
    if (stdinResolver) {
      const r = stdinResolver;
      stdinResolver = null;
      r(line);
    } else {
      stdinQueue.push(line);
    }
  });

  function readOneStdinLine() {
    if (stdinQueue.length) return Promise.resolve(stdinQueue.shift());
    return new Promise((resolve) => {
      stdinResolver = resolve;
    });
  }

  for (const step of steps) {
    if (step.kind === 'emit') {
      if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));
      stdout.write(JSON.stringify(step.event) + '\n');
    } else if (step.kind === 'echo-stdin') {
      await readOneStdinLine();
    } else if (step.kind === 'exit') {
      exit(step.code ?? 0);
    } else {
      throw new Error(`Unknown step kind: ${step.kind}`);
    }
  }
  exit(0);
}

run().catch((err) => {
  console.error(err);
  exit(1);
});
```

### Step 3.2: Script de ejemplo

`tests/fixtures/claude-events/simple.script.json`:

```json
[
  { "kind": "emit", "delayMs": 10, "event": { "type": "session.status_running", "id": "evt_001" } },
  { "kind": "emit", "delayMs": 20, "event": { "type": "agent.message", "id": "evt_002", "content": [{ "type": "text", "text": "Hello." }] } },
  { "kind": "emit", "delayMs": 10, "event": { "type": "session.status_idle", "id": "evt_003", "stop_reason": { "type": "end_turn" } } },
  { "kind": "exit", "code": 0 }
]
```

> **Importante:** los `event` payloads aquí son provisionales. **Tras Task 1, ajustar los shapes a lo que el spike encontró.** El plan asume que `Task 1` revisa este archivo si los nombres de campos difieren.

### Step 3.3: Helper para invocar fake-claude

`tests/unit/helpers/fake-claude-runner.ts`:

```ts
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const FAKE_CLAUDE = resolve(here, '../../fixtures/fake-claude.mjs');

export interface RunFakeClaudeOptions {
  scriptPath: string;
  cwd?: string;
}

export function runFakeClaude(opts: RunFakeClaudeOptions): ChildProcess {
  return spawn('node', [FAKE_CLAUDE, '--script', opts.scriptPath], {
    cwd: opts.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
```

### Step 3.4: Smoke test del fake-claude

`tests/unit/main/claude/fake-claude.smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { runFakeClaude } from '../../helpers/fake-claude-runner';

describe('fake-claude.mjs (smoke)', () => {
  it('emits the events listed in its script in order', async () => {
    const proc = runFakeClaude({
      scriptPath: resolve(__dirname, '../../../fixtures/claude-events/simple.script.json'),
    });
    const lines: string[] = [];
    const rl = createInterface({ input: proc.stdout! });
    rl.on('line', (l) => lines.push(l));
    await new Promise((r) => proc.on('exit', r));
    expect(lines).toHaveLength(3);
    const types = lines.map((l) => JSON.parse(l).type);
    expect(types).toEqual(['session.status_running', 'agent.message', 'session.status_idle']);
  });
});
```

### Step 3.5: Verify

```bash
pnpm test
```

### Step 3.6: Commit

```bash
git add tests/fixtures/fake-claude.mjs tests/fixtures/claude-events/simple.script.json tests/unit/helpers/fake-claude-runner.ts tests/unit/main/claude/fake-claude.smoke.test.ts
git commit -m "$(cat <<'EOF'
test(fake-claude): deterministic CLI stand-in for session tests

fake-claude.mjs reads a JSON script of {emit | echo-stdin | exit}
steps and produces a deterministic NDJSON stream on stdout, plus
can consume one stdin line at a chosen step. Powers all unit and E2E
tests for ClaudeSession without ever hitting the real CLI or the API.

A smoke test verifies the runner: feed it the simple script, see the
three expected events come back in order.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 4: NDJSON protocol parser

**Files:**
- Create: `src/main/claude/protocol.ts`
- Create: `tests/unit/main/claude/protocol.test.ts`

### Step 4.1: Failing test sobre fixtures reales del spike

`tests/unit/main/claude/protocol.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEventLine, eventsToMessages } from '../../../../src/main/claude/protocol';

function loadFixture(name: string): string[] {
  const p = resolve(__dirname, `../../../fixtures/claude-events/${name}.ndjson`);
  return readFileSync(p, 'utf8').split('\n').filter(Boolean);
}

describe('parseEventLine', () => {
  it('returns a typed StreamEvent for a well-formed agent.message line', () => {
    const lines = loadFixture('simple-text');
    const evt = parseEventLine(lines[0]!);
    expect(evt).not.toBeNull();
    // Concrete assertion depends on spike findings — pin the actual `type` string.
  });

  it('returns null and does not throw on a malformed line', () => {
    expect(parseEventLine('not json{')).toBeNull();
  });
});

describe('eventsToMessages', () => {
  it('converts simple-text fixture into a single claude Message', () => {
    const events = loadFixture('simple-text').map((l) => parseEventLine(l)).filter((e) => e !== null);
    const messages = eventsToMessages(events as any);
    expect(messages.filter((m) => m.type === 'claude')).toHaveLength(1);
  });

  it('groups tool_use + tool_result into a single tool Message with status:done', () => {
    const events = loadFixture('with-tool-use').map((l) => parseEventLine(l)).filter((e) => e !== null);
    const messages = eventsToMessages(events as any);
    const tool = messages.find((m) => m.type === 'tool');
    expect(tool).toBeDefined();
    if (tool?.type === 'tool') {
      expect(tool.status).toBe('done');
      expect(typeof tool.name).toBe('string');
    }
  });
});
```

### Step 4.2: Implementar `src/main/claude/protocol.ts`

Estructura del módulo (el shape exacto depende del spike — ajustar):

```ts
import type { Message } from '@shared/session';

/**
 * Discriminated union of the `claude --output-format stream-json` events
 * as observed in tests/fixtures/claude-events/. Field names are pinned
 * here so the parser can be tested in isolation.
 */
export type StreamEvent =
  | { type: 'session.status_running'; id: string }
  | { type: 'session.status_idle'; id: string; stop_reason: { type: string } }
  | { type: 'agent.message'; id: string; content: ContentBlock[] }
  | { type: 'agent.tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'agent.tool_result'; id: string; tool_use_id: string; content: ContentBlock[] }
  | { type: 'session.error'; id: string; error: { type: string; message: string } };

export type ContentBlock = { type: 'text'; text: string };

/**
 * Parse one NDJSON line into a StreamEvent. Returns null when the line
 * is empty, not JSON, or has an unknown `type` — the caller decides
 * whether to log or ignore.
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
  if (typeof obj.type !== 'string' || typeof obj.id !== 'string') return null;
  // Narrow by type — the union members above are mutually exclusive.
  switch (obj.type) {
    case 'session.status_running':
    case 'session.status_idle':
    case 'agent.message':
    case 'agent.tool_use':
    case 'agent.tool_result':
    case 'session.error':
      return obj as unknown as StreamEvent;
    default:
      return null;
  }
}

/**
 * Fold a stream of events into the rendered Message history.
 * tool_use + tool_result pairs collapse into a single tool Message;
 * agent.message lines become claude Messages; etc.
 */
export function eventsToMessages(events: StreamEvent[]): Message[] {
  const messages: Message[] = [];
  const toolIdx = new Map<string, number>();
  let now = Date.now();

  for (const evt of events) {
    now += 1;
    switch (evt.type) {
      case 'agent.message': {
        const text = evt.content.map((c) => c.text).join('');
        messages.push({ type: 'claude', id: evt.id, text, ts: now });
        break;
      }
      case 'agent.tool_use': {
        const idx = messages.push({
          type: 'tool',
          id: evt.id,
          name: evt.name,
          input: evt.input,
          status: 'running',
          ts: now,
        }) - 1;
        toolIdx.set(evt.id, idx);
        break;
      }
      case 'agent.tool_result': {
        const idx = toolIdx.get(evt.tool_use_id);
        if (idx === undefined) break;
        const existing = messages[idx];
        if (existing?.type !== 'tool') break;
        existing.status = 'done';
        existing.output = evt.content.map((c) => c.text).join('');
        break;
      }
      case 'session.error': {
        messages.push({
          type: 'system',
          id: evt.id,
          text: `Error: ${evt.error.message}`,
          ts: now,
        });
        break;
      }
      // status_running / status_idle don't produce messages — they update SessionStatus.
      default:
        break;
    }
  }
  return messages;
}
```

### Step 4.3: Verify

```bash
pnpm test
```

Expected: parser tests verdes contra fixtures reales.

### Step 4.4: Commit

```bash
git add src/main/claude/protocol.ts tests/unit/main/claude/protocol.test.ts
git commit -m "$(cat <<'EOF'
feat(claude): NDJSON protocol parser and event-to-message folding

parseEventLine narrows untrusted JSON lines into a StreamEvent
discriminated union (or null on parse failure / unknown type — never
throws). eventsToMessages folds a sequence of events into the rendered
Message history: tool_use + tool_result pairs collapse into a single
tool Message with status transitions; agent.message text concatenates
content blocks; session.error becomes a system message.

Tested against the real fixtures captured in Task 1, so the schema is
pinned to what the actual CLI emits, not to the SDK-derived guesses in
the research doc.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 5: `ClaudeSession` class

**Files:**
- Create: `src/main/claude/locator.ts`
- Create: `src/main/claude/session.ts`
- Create: `tests/unit/main/claude/session.test.ts`
- Create: `tests/fixtures/claude-events/with-tool-use.script.json`

### Step 5.1: `locator.ts`

```ts
import { execaSync, ExecaError } from 'execa';

export interface ClaudeBinary {
  path: string;
  version: string;
}

/**
 * Find the `claude` executable on PATH and capture its version string.
 * Throws if not found — Phase 3 requires it.
 */
export function locateClaude(): ClaudeBinary {
  try {
    const { stdout: pathOut } = execaSync('which', ['claude']);
    const { stdout: versionOut } = execaSync(pathOut.trim(), ['--version']);
    return { path: pathOut.trim(), version: versionOut.trim() };
  } catch (err) {
    if (err instanceof ExecaError) {
      throw new Error(`claude not found on PATH: ${err.stderr ?? err.message}`);
    }
    throw err;
  }
}
```

Override path para tests:

```ts
let override: string | null = null;

export function setClaudeBinaryForTests(path: string | null): void {
  override = path;
}

export function claudeBinary(): string {
  if (override) return override;
  return locateClaude().path;
}
```

### Step 5.2: `session.ts`

```ts
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface, type Interface as ReadlineInterface } from 'node:readline';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { Message, SessionId, SessionSnapshot, SessionStatus } from '@shared/session';
import { parseEventLine, eventsToMessages, type StreamEvent } from './protocol.js';
import { claudeBinary } from './locator.js';

export interface ClaudeSessionOptions {
  worktreeId: string;
  cwd: string;
  model?: string;
}

export interface ClaudeSessionEvents {
  snapshot: (snap: SessionSnapshot) => void;
  exit: (code: number | null) => void;
}

export class ClaudeSession extends EventEmitter {
  private proc: ChildProcess | null = null;
  private rl: ReadlineInterface | null = null;
  private events: StreamEvent[] = [];
  private status: SessionStatus = 'idle';
  private readonly id: SessionId;
  private readonly opts: ClaudeSessionOptions;

  constructor(opts: ClaudeSessionOptions) {
    super();
    this.opts = opts;
    this.id = { worktreeId: opts.worktreeId, uuid: randomUUID() };
  }

  snapshot(): SessionSnapshot {
    return {
      id: this.id,
      status: this.status,
      model: this.opts.model ?? 'sonnet',
      messages: eventsToMessages(this.events),
      awaitingToolUseId: this.findAwaitingToolUseId(),
    };
  }

  /** Spawn `claude -p --output-format stream-json …` with `prompt` as the initial argument. */
  start(prompt: string): void {
    if (this.proc) throw new Error('already started');
    const args = [
      '-p',
      '--output-format', 'stream-json',
      '--model', this.opts.model ?? 'sonnet',
      // Phase 3 default: bypassPermissions for the first slice unless the spike
      // confirms `default` works with a stdin approval shape.
      '--permission-mode', 'bypassPermissions',
      '--session-id', this.id.uuid,
      prompt,
    ];
    this.proc = spawn(claudeBinary(), args, {
      cwd: this.opts.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    this.status = 'running';
    this.emit('snapshot', this.snapshot());

    this.rl = createInterface({ input: this.proc.stdout! });
    this.rl.on('line', (line) => {
      const evt = parseEventLine(line);
      if (!evt) return;
      this.events.push(evt);
      if (evt.type === 'session.status_idle') this.status = 'idle';
      else if (evt.type === 'session.error') this.status = 'error';
      this.emit('snapshot', this.snapshot());
    });

    this.proc.on('exit', (code) => {
      this.status = code === 0 ? 'exited' : 'error';
      this.emit('snapshot', this.snapshot());
      this.emit('exit', code);
    });
  }

  /**
   * Phase 3 default: Scenario B (fresh process per prompt with --session-id).
   * If the spike confirms live stdin works, this is overridden in a follow-up.
   */
  send(prompt: string): void {
    if (this.proc) {
      this.kill();
    }
    this.start(prompt);
  }

  kill(): void {
    if (!this.proc) return;
    this.proc.kill();
    this.proc = null;
    this.rl?.close();
    this.rl = null;
  }

  private findAwaitingToolUseId(): string | null {
    // Phase 3 doesn't implement approval flow until spike confirms it works.
    return null;
  }
}
```

### Step 5.3: Tests con fake-claude

`tests/unit/main/claude/session.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { ClaudeSession } from '../../../../src/main/claude/session';
import { setClaudeBinaryForTests } from '../../../../src/main/claude/locator';

const FAKE = resolve(__dirname, '../../../fixtures/fake-claude.mjs');

describe('ClaudeSession (with fake-claude)', () => {
  beforeEach(() => {
    // Override the binary lookup so spawn(claude) actually runs fake-claude.
    // But ClaudeSession spawns positional args — we need a wrapper.
    // Simpler: temporarily set the binary to node + intercept via test-only env.
    setClaudeBinaryForTests('node');
  });
  afterEach(() => setClaudeBinaryForTests(null));

  it.skip('emits snapshots as fake-claude emits events', async () => {
    // PENDING: ClaudeSession passes args after the binary, but fake-claude
    // needs `--script <path>` rather than the real `claude` arg shape. Either
    // ClaudeSession needs a hook to override the arg builder, or the test
    // uses a different injection point. Define the seam in implementation.
  });
});
```

> **Nota:** la `ClaudeSession` actual asume el binario es `claude` con sus flags reales. Para tests con fake-claude, hay que abrir un seam — opciones:
> 1. Inyectar el arg builder vía opción (`buildArgs?: (prompt, opts) => string[]`).
> 2. Detectar `NODE_ENV === 'test'` y usar fake-claude path + `--script` env var.
> 3. **Recomendado:** la opción 1. Limpio, sin condicionales en producción.
>
> El implementer decide y documenta. El skip-test arriba marca esto explícitamente.

### Step 5.4: Verify + commit

```bash
pnpm test && pnpm typecheck
git add src/main/claude/locator.ts src/main/claude/session.ts tests/unit/main/claude/session.test.ts
git commit -m "$(cat <<'EOF'
feat(claude): ClaudeSession spawning claude-cli with stream-json output

ClaudeSession owns one `claude` subprocess per worktree. On start() it
spawns `claude -p --output-format stream-json --session-id <uuid>
<prompt>`, parses NDJSON via protocol.ts, accumulates events, and emits
SessionSnapshot updates after every line.

Phase 3 implements Scenario B (kill + spawn per prompt with the same
session UUID) because the runtime spike did not confirm live stdin
input. send(prompt) cycles the process; kill() terminates and cleans up.

locator.ts isolates `which claude` so tests can override the binary
without touching child_process directly. The actual test wiring with
fake-claude needs an arg-builder seam — pending in the test file as a
skip with a TODO.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 6: `SessionManager`

**Files:**
- Create: `src/main/claude/manager.ts`
- Create: `tests/unit/main/claude/manager.test.ts`

### Step 6.1: `manager.ts`

```ts
import { EventEmitter } from 'node:events';
import { ClaudeSession, type ClaudeSessionOptions } from './session.js';
import type { SessionSnapshot } from '@shared/session';

/**
 * Phase 3: 1 session per worktree. The Map<wtId, ClaudeSession[]> shape
 * already supports N for Phase 4 — only the enforcement of length === 1
 * changes here.
 */
export class SessionManager extends EventEmitter {
  private readonly sessionsByWt = new Map<string, ClaudeSession[]>();

  startForWorktree(opts: ClaudeSessionOptions): ClaudeSession {
    const existing = this.sessionsByWt.get(opts.worktreeId) ?? [];
    if (existing.length >= 1) {
      // Phase 3 cap. Phase 4 raises this. Return existing instead of throwing
      // — UX: user clicks "new session" twice rapidly should not error.
      return existing[0]!;
    }
    const session = new ClaudeSession(opts);
    session.on('snapshot', (snap) => this.emit('snapshot', snap));
    session.on('exit', () => {
      const list = this.sessionsByWt.get(opts.worktreeId);
      if (list) {
        const i = list.indexOf(session);
        if (i >= 0) list.splice(i, 1);
      }
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
    this.sessionsByWt.delete(worktreeId);
  }

  killAll(): void {
    for (const list of this.sessionsByWt.values()) {
      for (const s of list) s.kill();
    }
    this.sessionsByWt.clear();
  }
}
```

### Step 6.2: Tests

`tests/unit/main/claude/manager.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SessionManager } from '../../../../src/main/claude/manager';

describe('SessionManager', () => {
  it('enforces 1 session per worktree (returns existing on second startForWorktree)', () => {
    const mgr = new SessionManager();
    const a = mgr.startForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    const b = mgr.startForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    expect(a).toBe(b);
  });

  it('killForWorktree removes the entry', () => {
    const mgr = new SessionManager();
    mgr.startForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    mgr.killForWorktree('wt-1');
    expect(mgr.getForWorktree('wt-1')).toBeNull();
  });
});
```

(No actual `start()` on the session — manager unit tests don't need to spawn anything.)

### Step 6.3: Verify + commit.

---

## Task 7: IPC `sessions:*` channels + events

**Files:**
- Create: `src/main/ipc/sessions.ts`
- Modify: `src/main/ipc/index.ts`
- Modify: `src/main/index.ts`

### Step 7.1: `src/main/ipc/sessions.ts`

```ts
import { createHandler } from './register.js';
import { sendEvent } from './events.js';
import type { ProjectRegistry } from '../projects/index.js';
import type { SessionManager } from '../claude/manager.js';
import { createGitClient } from '../git/index.js';

export function registerSessions(
  registry: ProjectRegistry,
  manager: SessionManager,
): void {
  function worktreePath(worktreeId: string): string {
    for (const project of registry.list()) {
      // The worktree id encodes the project path; resolve via GitClient.
      // (Phase 3 keeps this simple — Phase 4 may add a lookup table.)
      const client = createGitClient(project.path);
      // The id format is `${repoRoot}:${worktreePath}`; split it.
      const sep = worktreeId.indexOf(':');
      if (sep === -1) continue;
      const root = worktreeId.slice(0, sep);
      const path = worktreeId.slice(sep + 1);
      if (root === project.path) return path;
      void client;
    }
    throw new Error(`Worktree not found: ${worktreeId}`);
  }

  // Subscribe once to manager snapshots and broadcast.
  manager.on('snapshot', (snap) => {
    sendEvent('sessions:event', { worktreeId: snap.id.worktreeId, snapshot: snap });
  });

  createHandler('sessions:start', ({ worktreeId }) => {
    const cwd = worktreePath(worktreeId);
    const session = manager.startForWorktree({ worktreeId, cwd });
    return Promise.resolve(session.snapshot());
  });

  createHandler('sessions:send', ({ worktreeId, text }) => {
    const cwd = worktreePath(worktreeId);
    const session =
      manager.getForWorktree(worktreeId) ??
      manager.startForWorktree({ worktreeId, cwd });
    session.send(text);
    return Promise.resolve();
  });

  createHandler('sessions:kill', ({ worktreeId }) => {
    manager.killForWorktree(worktreeId);
    return Promise.resolve();
  });

  createHandler('sessions:approve-tool', () => {
    // Phase 3 uses bypassPermissions; approval flow lands once the
    // spike confirms the stdin protocol. No-op for now.
    return Promise.resolve();
  });

  createHandler('sessions:get', ({ worktreeId }) => {
    return Promise.resolve(manager.snapshotForWorktree(worktreeId));
  });
}
```

### Step 7.2: Wire in `src/main/ipc/index.ts`

Añadir `SessionManager` a `IpcDeps`:

```ts
export interface IpcDeps {
  store: JideStore;
  registry: ProjectRegistry;
  manager: SessionManager;
  afterProjectsMutation: () => void;
}
```

Llamar `registerSessions(deps.registry, deps.manager)`.

### Step 7.3: Wire en `src/main/index.ts`

Instanciar `const manager = new SessionManager();`, pasarlo en `registerAllHandlers`, y añadir `before-quit` para `manager.killAll()`.

### Step 7.4: Verify + commit.

---

## Task 8: Message components

**Files:**
- Create: `src/renderer/src/components/Chat/Message.tsx` (router)
- Create: `src/renderer/src/components/Chat/UserMessage.tsx`
- Create: `src/renderer/src/components/Chat/ClaudeMessage.tsx`
- Create: `src/renderer/src/components/Chat/ToolMessage.tsx`
- Create: `src/renderer/src/components/Chat/DiffMessage.tsx`
- Create: `src/renderer/src/components/Chat/SystemMessage.tsx`
- Create: `src/renderer/src/components/Chat/StreamingIndicator.tsx`

Cada uno es un componente de presentación puro. `Message.tsx` es un router por `message.type`. Estilos: portar del mock `design/project/jide/chat.jsx`, con hex inline (Phase 5 mueve a ThemeProvider).

> Detalles: ver `design/project/jide/chat.jsx` para inspiración visual. Mantener data-testid: `message-${id}` y `message-type-${type}`.

### Tasks 9–11: Composer + ApprovalBar + useSession + wire App

Análogos a Task 8 — UI components + hook + integración en App.tsx. Composer expone un onSubmit que llama `window.jide.sessions.send(activeWtId, text)`. ApprovalBar se renderiza cuando `snapshot.awaitingToolUseId !== null` (sólo cuando el spike confirme aprobaciones — sino, oculto).

useSession:

```ts
export function useSession(worktreeId: string | null): { snapshot: SessionSnapshot | null; send: (text: string) => Promise<void>; kill: () => Promise<void> } {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  useEffect(() => {
    if (!worktreeId) return;
    void window.jide.sessions.get(worktreeId).then(setSnapshot);
    const off = window.jide.on('sessions:event', (payload) => {
      if (payload.worktreeId !== worktreeId) return;
      setSnapshot(payload.snapshot);
    });
    return off;
  }, [worktreeId]);
  // ...
}
```

App.tsx: el placeholder central se reemplaza por `<ChatPanel worktreeId={activeWorktreeId} />` cuando hay activo.

### Task 12: E2E con fake-claude

`tests/e2e/session.spec.ts`:

```ts
// 1. Init project + worktree (reusing helpers from phase 2 e2e).
// 2. Override JIDE_CLAUDE_BINARY=/path/to/fake-claude.mjs via launchJide opts.
// 3. Open chat panel, type a prompt, click Send.
// 4. Assert a UserMessage and a ClaudeMessage appear with the fake script's content.
// 5. Click Kill, assert the SessionStatus drops to 'exited'.
```

Esto requiere extender `launchJide` con `claudeBinary?: string` que se forwardea a `JIDE_CLAUDE_BINARY` env var, leído por `locator.ts` antes de `which claude`.

### Task 13: Cleanup on quit + DoD

- `app.on('before-quit')` → `manager.killAll()`.
- Verify checklist completo. `pnpm verify` verde.

---

## Definition of Done — Fase 3

- [ ] `pnpm verify` pasa local: typecheck + lint + format + unit + e2e.
- [ ] GH Actions verde en la rama de Fase 3.
- [ ] Spike runtime ejecutado y fixtures grabados (`tests/fixtures/claude-events/*.ndjson`).
- [ ] Selecciono un worktree → escribo un prompt en el composer → veo la respuesta de Claude streaming en pantalla (con fake-claude en tests; con CLI real ejercitado al menos una vez manualmente).
- [ ] Tool calls aparecen como tarjetas con cmd/file/status/output.
- [ ] Si el spike confirmó approvals: ApprovalBar funcional. Si no: ApprovalBar oculta y `--permission-mode bypassPermissions` usado por defecto, con anotación clara en Known Issues.
- [ ] El status dot del worktree en Sidebar refleja `running/idle` en tiempo real.
- [ ] Kill session mata el proceso y limpia el estado.
- [ ] Cerrar la app mientras hay sesiones activas las mata limpiamente (no zombies — verificable con `ps | grep claude` post-quit).

---

## Known issues / decisiones diferidas

- **Approval flow** — si el spike no confirma el shape stdin, Phase 3 usa `bypassPermissions` por defecto y la ApprovalBar queda como TODO. Phase 4 o un follow-up dedicado lo resuelve.
- **Live stdin (Scenario A)** — si el spike encuentra que `--input-format stream-json` no acepta `user.message` mid-session, Phase 3 implementa Scenario B (fresh process por prompt). UX latency más alta pero correcto.
- **Token / cost tracking** — el spike documentará si los eventos exponen tokens. Si no, `SessionSnapshot.tokens` queda `null` hasta que un canal IPC dedicado los traiga.
- **Una sesión por worktree** — Phase 4 sube el límite. `Map<wtId, ClaudeSession[]>` ya soporta N, sólo se cambia la constante.
- **Persistencia de sesiones** — al cerrar la app, las sesiones se matan. No hay resume al reabrir. Out of scope per roadmap; Phase 4+ puede añadir.
- **Auth flow** — Phase 3 asume `claude` ya autenticado en el sistema del usuario (env var, keychain, etc.). No hay UI de auth en la app. Phase 9 puede integrarlo.

---

## Hand-off a Fase 4

- `SessionManager.Map<wtId, ClaudeSession[]>` ya admite N — Phase 4 sube el límite y añade `SessionStrip` para cambiar entre ellas.
- `useSession` ya recibe `SessionSnapshot` por prop — Phase 4 envuelve con `<SessionStrip>` arriba.
- Si Phase 3 deja Scenario B (fresh process por prompt), Phase 4 puede revisitar Scenario A — el cambio es localizado en `ClaudeSession.send()`.
- Approval flow, si quedó como TODO en Phase 3, es bloqueador para release: Phase 4 lo cierra o se programa un workstream paralelo.
