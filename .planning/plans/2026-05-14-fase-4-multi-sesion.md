# Fase 4 — Multi-sesión por worktree (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un worktree puede tener hasta 4 sesiones Claude paralelas, cada una con su proceso y conversación independientes. El `SessionStrip` arriba del `ChatPanel` muestra chips horizontales para cambiar, crear (botón `+` o `⌘T`) y cerrar sesiones. El `SessionMeta` muestra modelo/coste/contexto/tokens de la sesión activa. Las sesiones (y sus transcripts) **persisten al cerrar la app y se rehidratan al reabrir**; un follow-up sobre una sesión persistida intenta resume vía `--session-id` y, si el CLI no la reconoce, arranca una conversación nueva limpiamente. Los títulos se infieren del primer prompt y son renombrables inline en el chip. El `StatusDot` del worktree en la Sidebar refleja el roll-up `running > awaiting > error > idle` sobre todas sus sesiones.

**Architecture:** El cambio fundamental es de modelo: la unidad de direccionamiento pasa de `worktreeId` a `(worktreeId, sessionUuid)` en el IPC y la UI. `SessionManager` ya almacena `Map<wtId, ClaudeSession[]>` (Fase 3) — Fase 4 sube el cap a 4, añade resolución por UUID, expone listas, y añade ciclo de vida persistente. Cada `ClaudeSession` gana metadata renombrable (`title`) y un campo `createdAt`. La persistencia vive en `electron-store` bajo `sessions: Record<worktreeId, PersistedSession[]>`; en boot el `SessionManager` rehidrata sesiones detached (sin proceso vivo) que el usuario activa al hacer send — `start()` añade `--resume <uuid>` cuando el snapshot trae historial, y degrada limpiamente si el CLI no reconoce el id. El roll-up de `Worktree.claude` se calcula en main process desde el `SessionManager` y se emite vía el mismo canal `worktrees:status-changed` ya existente, así la Sidebar no necesita conocer sesiones.

**Tech Stack añadido:** Nada nuevo. Reusa `electron-store` (Fase 1) y `node:events` para el pub-sub de roll-up. El test surface sigue siendo `fake-claude.mjs` (Fase 3) — ampliamos los scripts pero no tocamos el runner.

**Tests son deterministas, no consumen tokens.** Toda la suite usa `tests/fixtures/fake-claude.mjs`. Las pruebas de persistencia montan un `JIDE_TEST_STORE_CWD` aislado y verifican el roundtrip leer→escribir sobre el filesystem.

**Dependencia crítica:** Task 1 (constantes + tipos + IPC contract) bloquea Tasks 2-11. Tasks 12 (roll-up) y 13 (E2E) corren al final. Task 4 (persistencia) puede ir en paralelo con Tasks 6-10 (UI) si dos agentes se reparten el trabajo.

---

## Decisiones cerradas (entrada al plan)

| Pregunta | Respuesta | Implicación |
|---|---|---|
| Límite por worktree | **`MAX_SESSIONS_PER_WORKTREE = 4`**, configurable vía `SettingsSchema.maxSessionsPerWorktree` (default 4, rango válido 1–16). | Constante leída desde el store en `SessionManager` al crear sesión; mutar el setting NO mata sesiones existentes sobre el cap. |
| Comportamiento al cerrar app | **Opción B: persistir historial.** Snapshots por worktree se escriben al store en `before-quit`. Al reabrir, rehidratamos sesiones detached y los follow-ups intentan resume vía `--session-id`. | Añade `PersistedSession` type, escritura en quit, lectura en boot, fallback graceful cuando el CLI olvida la sesión. |
| Naming | **Auto-inferido del primer prompt + rename inline en Fase 4.** Doble-click sobre el chip habilita un input editable; Enter confirma, Esc cancela. | Heurística: primeras 32 chars del primer `user.message` o `"Sesión N"` si no hay aún. `ClaudeSession.rename(title)` + canal `sessions:rename`. |

---

## File structure (final, end-of-phase)

```
jide/
├── src/
│   ├── main/
│   │   ├── claude/
│   │   │   ├── session.ts                # +title, +createdAt, +rename(), +rehydrate(), +--resume arg path
│   │   │   ├── manager.ts                # cap configurable, lookups por uuid, list, persistir/rehidratar
│   │   │   ├── persistence.ts            # NEW: read/write PersistedSession[] desde el store
│   │   │   ├── rollup.ts                 # NEW: claudeStateForWorktree(snapshots[]) → ClaudeState
│   │   │   └── title.ts                  # NEW: inferTitleFromText(prompt) → string
│   │   ├── ipc/
│   │   │   ├── sessions.ts               # nuevos canales: list/create/rename/set-active/get-active + cambia send/kill/get a sessionId
│   │   │   └── events.ts                 # (sin cambios) — sigue sirviendo sessions:event + sessions:list-changed nuevo
│   │   ├── projects/
│   │   │   └── index.ts                  # +emitir worktrees:status-changed cuando cambia el roll-up
│   │   └── index.ts                      # persist on before-quit; rehydrate after store create
│   ├── preload/
│   │   └── index.ts                      # nuevos métodos sessions.list/create/rename/setActive/getActive
│   ├── renderer/src/
│   │   ├── components/
│   │   │   ├── Chat/
│   │   │   │   ├── ChatPanel.tsx         # SessionStrip + SessionMeta + EmptySessions; wire por sessionId
│   │   │   │   ├── SessionStrip.tsx      # NEW
│   │   │   │   ├── SessionChip.tsx       # NEW (con rename inline)
│   │   │   │   ├── SessionMeta.tsx       # NEW (band superior)
│   │   │   │   ├── EmptySessions.tsx     # NEW (CTA "Nueva sesión")
│   │   │   │   ├── useSessionHotkey.ts   # NEW (⌘T listener)
│   │   │   │   └── (resto sin cambios)
│   │   │   └── Sidebar/
│   │   │       └── WorktreeRow.tsx       # consume worktree.claude tal cual (roll-up viene del main)
│   │   └── shortcuts/
│   │       ├── useSession.ts             # firma cambia: (worktreeId, sessionUuid) → snapshot
│   │       └── useSessionsList.ts        # NEW: lista de snapshots por worktree
│   └── shared/
│       ├── session.ts                    # +title, +createdAt en SessionSnapshot; +PersistedSession
│       ├── settings.ts                   # +maxSessionsPerWorktree; +activeSessionByWt
│       └── ipc.ts                        # +channels sessions:list/create/rename/set-active/get-active; +event sessions:list-changed
└── tests/
    ├── fixtures/
    │   └── claude-events/
    │       ├── multi-session-a.script.json   # NEW: sesión que termina rápido (1 turn)
    │       ├── multi-session-b.script.json   # NEW: sesión larga (echo-stdin)
    │       └── (existentes intactos)
    ├── unit/
    │   ├── main/claude/
    │   │   ├── manager.test.ts          # cap=4, getById, list, killById, rehydrate
    │   │   ├── persistence.test.ts      # NEW: roundtrip serialización
    │   │   ├── rollup.test.ts           # NEW: cada combinación de estados
    │   │   └── title.test.ts            # NEW: heurística truncamiento + fallback
    │   └── shared/
    │       ├── ipc.test.ts              # drift guard ampliado
    │       └── session.test.ts          # drift guard ampliado
    └── e2e/
        └── multi-session.spec.ts        # NEW: 2 sesiones paralelas + persistencia roundtrip + ⌘T
```

**Responsabilidades clave:**

- `src/main/claude/manager.ts` — fuente única sobre `Map<wtId, ClaudeSession[]>`. Lookups por uuid via método `getById(worktreeId, uuid)`. Emite `'list-changed'` además del existente `'snapshot'`.
- `src/main/claude/persistence.ts` — único módulo que conoce el shape de `electron-store` para sesiones. Aislado para que tests le inyecten un store en memoria.
- `src/main/claude/rollup.ts` — función pura `claudeStateForWorktree(SessionSnapshot[]) → ClaudeState`. Testeable sin dependencias.
- `src/main/claude/title.ts` — función pura `inferTitle(text: string): string`. Trunca, normaliza whitespace, sin acceso a I/O.
- `src/renderer/src/components/Chat/SessionStrip.tsx` — UI presentacional. Recibe lista de snapshots + activeUuid por prop; emite eventos.
- `src/renderer/src/components/Chat/SessionChip.tsx` — chip individual con tres estados visuales (active, idle, status-running) + rename inline mode.

---

## Conventional Commits — recordatorio

Todos los commits siguen la convención del repo (ver `~/.claude/CLAUDE.md`):

```
type(scope): short description in imperative mood

Optional body explaining the why (English).

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
```

No `Co-Authored-By`. No `Task:` trailer (rama `feat/fase-4-multi-sesion` no tiene ID Asana).

---

## Task 1: Shared types, settings & IPC contract

**Files:**
- Modify: `src/shared/session.ts`
- Modify: `src/shared/settings.ts`
- Modify: `src/shared/ipc.ts`
- Modify: `src/preload/index.ts`
- Modify: `tests/unit/shared/session.test.ts`
- Modify: `tests/unit/shared/ipc.test.ts`

### Step 1.1: Extender `SessionSnapshot` con `title`, `createdAt`

Modificar `src/shared/session.ts:70-82`:

```ts
export interface SessionSnapshot {
  id: SessionId;
  status: SessionStatus;
  model: string;
  cwd: string;
  /** Inferred from the first user prompt, or user-renamed. Defaults to "Sesión N" until a prompt arrives. */
  title: string;
  /** Unix ms when the session was first created in this jide installation. Stable across rehydrations. */
  createdAt: number;
  messages: Message[];
  rateLimit: RateLimitInfo | null;
  awaitingToolUseId: string | null;
  totalCostUsd: number;
}

/**
 * Shape persisted in electron-store under `sessions[worktreeId][]`.
 * Strictly a superset of SessionSnapshot — adds nothing today but
 * pinned as its own type so a future schema version (e.g. adding
 * `messagesCompressed`) doesn't leak into the runtime contract.
 */
export type PersistedSession = SessionSnapshot;
```

### Step 1.2: Extender `SettingsSchema`

Modificar `src/shared/settings.ts:5-15`:

```ts
import type { Project } from './project.js';
import type { PersistedSession } from './session.js';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface SettingsSchema {
  theme: ThemeMode;
  lastWorktreeId: string | null;
  projects: Project[];
  /** 1..16. Default 4. */
  maxSessionsPerWorktree: number;
  /** worktreeId → sessionUuid. Selects which session focuses when the worktree is opened. */
  activeSessionByWt: Record<string, string>;
  /** worktreeId → list of persisted session snapshots. */
  sessions: Record<string, PersistedSession[]>;
}

export const DEFAULT_SETTINGS: SettingsSchema = {
  theme: 'auto',
  lastWorktreeId: null,
  projects: [],
  maxSessionsPerWorktree: 4,
  activeSessionByWt: {},
  sessions: {},
};

export type SettingsKey = keyof SettingsSchema;
```

### Step 1.3: Ampliar `CHANNELS`, `ChannelMap`, `EVENTS`, `EventMap`

Modificar `src/shared/ipc.ts`. Añadir a `CHANNELS`:

```
'sessions:list',
'sessions:create',
'sessions:rename',
'sessions:set-active',
'sessions:get-active',
```

Cambiar la firma de `sessions:send`, `sessions:kill`, `sessions:get`, `sessions:approve-tool` para incluir `sessionId: string`:

```ts
'sessions:list': { req: { worktreeId: string }; res: SessionSnapshot[] };
'sessions:create': { req: { worktreeId: string }; res: SessionSnapshot };
'sessions:send': { req: { worktreeId: string; sessionId: string; text: string }; res: void };
'sessions:kill': { req: { worktreeId: string; sessionId: string }; res: void };
'sessions:get': { req: { worktreeId: string; sessionId: string }; res: SessionSnapshot | null };
'sessions:approve-tool': {
  req: { worktreeId: string; sessionId: string; toolUseId: string; allow: boolean; reason?: string };
  res: void;
};
'sessions:rename': { req: { worktreeId: string; sessionId: string; title: string }; res: void };
'sessions:set-active': { req: { worktreeId: string; sessionId: string }; res: void };
'sessions:get-active': { req: { worktreeId: string }; res: string | null };
```

> **Nota sobre `sessions:start`**: Phase 3 lo usaba para crear-o-devolver-existente. Phase 4 lo **elimina** del set y pasa la responsabilidad a `sessions:create` (siempre crea uno nuevo). El handler antiguo se borra en Task 5.

Eliminar `'sessions:start'` de `CHANNELS` y de `ChannelMap`.

Añadir a `EVENTS`:

```
'sessions:list-changed',
```

Añadir a `EventMap`:

```ts
'sessions:list-changed': { worktreeId: string; sessions: SessionSnapshot[] };
```

Actualizar `JideApi`:

```ts
sessions: {
  list: (worktreeId: string) => Promise<SessionSnapshot[]>;
  create: (worktreeId: string) => Promise<SessionSnapshot>;
  send: (worktreeId: string, sessionId: string, text: string) => Promise<void>;
  kill: (worktreeId: string, sessionId: string) => Promise<void>;
  get: (worktreeId: string, sessionId: string) => Promise<SessionSnapshot | null>;
  approveTool: (
    worktreeId: string,
    sessionId: string,
    toolUseId: string,
    allow: boolean,
    reason?: string,
  ) => Promise<void>;
  rename: (worktreeId: string, sessionId: string, title: string) => Promise<void>;
  setActive: (worktreeId: string, sessionId: string) => Promise<void>;
  getActive: (worktreeId: string) => Promise<string | null>;
};
```

### Step 1.4: Drift-guard tests

Ampliar `tests/unit/shared/session.test.ts` con:

```ts
it('SessionSnapshot exposes title and createdAt', () => {
  expectTypeOf<SessionSnapshot['title']>().toEqualTypeOf<string>();
  expectTypeOf<SessionSnapshot['createdAt']>().toEqualTypeOf<number>();
});

it('PersistedSession is structurally a SessionSnapshot', () => {
  expectTypeOf<PersistedSession>().toEqualTypeOf<SessionSnapshot>();
});
```

Ampliar `tests/unit/shared/ipc.test.ts` (basado en su shape existente — leer primero):

```ts
it('declares the multi-session channels', () => {
  expect(CHANNELS).toContain('sessions:list');
  expect(CHANNELS).toContain('sessions:create');
  expect(CHANNELS).toContain('sessions:rename');
  expect(CHANNELS).toContain('sessions:set-active');
  expect(CHANNELS).toContain('sessions:get-active');
  expect(CHANNELS).not.toContain('sessions:start');
});

it('sessions:list-changed payload carries the list', () => {
  expectTypeOf<EventPayload<'sessions:list-changed'>>().toEqualTypeOf<{
    worktreeId: string;
    sessions: SessionSnapshot[];
  }>();
});

it('sessions:send requires sessionId', () => {
  expectTypeOf<Req<'sessions:send'>>().toEqualTypeOf<{
    worktreeId: string;
    sessionId: string;
    text: string;
  }>();
});
```

### Step 1.5: Extender preload

Modificar `src/preload/index.ts` — añadir métodos nuevos y cambiar la firma de los existentes para incluir `sessionId`. Eliminar `start`:

```ts
sessions: {
  list: (worktreeId) => ipcRenderer.invoke('sessions:list', { worktreeId }) as Promise<SessionSnapshot[]>,
  create: (worktreeId) => ipcRenderer.invoke('sessions:create', { worktreeId }) as Promise<SessionSnapshot>,
  send: (worktreeId, sessionId, text) =>
    ipcRenderer.invoke('sessions:send', { worktreeId, sessionId, text }) as Promise<void>,
  kill: (worktreeId, sessionId) =>
    ipcRenderer.invoke('sessions:kill', { worktreeId, sessionId }) as Promise<void>,
  get: (worktreeId, sessionId) =>
    ipcRenderer.invoke('sessions:get', { worktreeId, sessionId }) as Promise<SessionSnapshot | null>,
  approveTool: (worktreeId, sessionId, toolUseId, allow, reason) =>
    ipcRenderer.invoke('sessions:approve-tool', { worktreeId, sessionId, toolUseId, allow, reason }) as Promise<void>,
  rename: (worktreeId, sessionId, title) =>
    ipcRenderer.invoke('sessions:rename', { worktreeId, sessionId, title }) as Promise<void>,
  setActive: (worktreeId, sessionId) =>
    ipcRenderer.invoke('sessions:set-active', { worktreeId, sessionId }) as Promise<void>,
  getActive: (worktreeId) =>
    ipcRenderer.invoke('sessions:get-active', { worktreeId }) as Promise<string | null>,
},
```

### Step 1.6: Verify

```bash
pnpm typecheck && pnpm test -- --run tests/unit/shared
```

Expected: drift-guard tests verdes; el resto del repo seguramente **rojo** en typecheck (ChatPanel/useSession/sessions.ts todavía esperan la API antigua). Eso es esperado y se resuelve en Tasks siguientes.

### Step 1.7: Commit

```bash
git add src/shared/session.ts src/shared/settings.ts src/shared/ipc.ts src/preload/index.ts tests/unit/shared/
git commit -m "$(cat <<'EOF'
feat(shared): session metadata, persistence schema, and multi-session IPC contract

SessionSnapshot gains `title` (inferred from first prompt, renamable)
and `createdAt`. SettingsSchema adds `maxSessionsPerWorktree` (default
4), `activeSessionByWt` (worktreeId → sessionUuid), and `sessions`
(worktreeId → PersistedSession[]) for persistence across restarts.

IPC channels shift from worktree-keyed to (worktreeId, sessionId)-
keyed: `sessions:send/kill/get/approve-tool` all carry sessionId now,
and three new channels — `sessions:list`, `sessions:create`,
`sessions:rename`, `sessions:set-active`, `sessions:get-active` —
expose multi-session lifecycle. The old `sessions:start` channel is
removed; `sessions:create` replaces it with explicit semantics.

Renderer-facing handlers and renderer code still target the Phase 3
API and will be migrated in Tasks 5-10 of this phase; typecheck on
those files is intentionally red until then.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 2: Title inference helper

**Files:**
- Create: `src/main/claude/title.ts`
- Create: `tests/unit/main/claude/title.test.ts`

### Step 2.1: Failing tests

`tests/unit/main/claude/title.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { inferTitle, defaultTitle } from '../../../../src/main/claude/title';

describe('title inference', () => {
  it('takes the first 32 characters of a single-line prompt', () => {
    expect(inferTitle('Add a unit test for the parser')).toBe('Add a unit test for the parser');
  });

  it('truncates and adds an ellipsis past 32 chars', () => {
    expect(inferTitle('This is a much longer prompt that should be truncated nicely'))
      .toBe('This is a much longer prompt th…');
    expect(inferTitle('This is a much longer prompt th…').length).toBeLessThanOrEqual(32);
  });

  it('collapses internal whitespace', () => {
    expect(inferTitle('Add   a\nlot   of   spaces')).toBe('Add a lot of spaces');
  });

  it('trims leading/trailing whitespace', () => {
    expect(inferTitle('   hello   ')).toBe('hello');
  });

  it('returns the fallback for empty/whitespace input', () => {
    expect(inferTitle('')).toBe('');
    expect(inferTitle('   ')).toBe('');
  });

  it('defaultTitle uses 1-based numbering', () => {
    expect(defaultTitle(0)).toBe('Sesión 1');
    expect(defaultTitle(3)).toBe('Sesión 4');
  });
});
```

### Step 2.2: Implementación

`src/main/claude/title.ts`:

```ts
const MAX_LEN = 32;
const ELLIPSIS = '…';

export function inferTitle(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= MAX_LEN) return normalized;
  return normalized.slice(0, MAX_LEN - ELLIPSIS.length) + ELLIPSIS;
}

export function defaultTitle(zeroBasedIndex: number): string {
  return `Sesión ${zeroBasedIndex + 1}`;
}
```

### Step 2.3: Verify + commit

```bash
pnpm test -- --run tests/unit/main/claude/title.test.ts
git add src/main/claude/title.ts tests/unit/main/claude/title.test.ts
git commit -m "$(cat <<'EOF'
feat(claude): title inference helper for sessions

inferTitle collapses whitespace, trims, and truncates to 32 chars with
a single-char ellipsis. Empty input returns the empty string so callers
can fall back to defaultTitle(index), which produces "Sesión N"
(1-based) for the chip label until the first prompt lands.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 3: Roll-up function

**Files:**
- Create: `src/main/claude/rollup.ts`
- Create: `tests/unit/main/claude/rollup.test.ts`

### Step 3.1: Failing tests

`tests/unit/main/claude/rollup.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { SessionSnapshot, SessionStatus } from '@shared/session';
import { claudeStateForWorktree } from '../../../../src/main/claude/rollup';

function snap(status: SessionStatus): SessionSnapshot {
  return {
    id: { worktreeId: 'wt', uuid: status },
    status,
    model: 'sonnet',
    cwd: '/tmp',
    title: 't',
    createdAt: 0,
    messages: [],
    rateLimit: null,
    awaitingToolUseId: null,
    totalCostUsd: 0,
  };
}

describe('claudeStateForWorktree', () => {
  it('returns idle for an empty list', () => {
    expect(claudeStateForWorktree([])).toBe('idle');
  });

  it('returns idle when all sessions are idle/exited', () => {
    expect(claudeStateForWorktree([snap('idle'), snap('exited')])).toBe('idle');
  });

  it('prioritises running over awaiting/error/idle', () => {
    expect(claudeStateForWorktree([snap('idle'), snap('streaming'), snap('error')])).toBe('running');
    expect(claudeStateForWorktree([snap('awaiting'), snap('requesting')])).toBe('running');
    expect(claudeStateForWorktree([snap('starting'), snap('error')])).toBe('running');
  });

  it('prioritises awaiting over error/idle when no session is running', () => {
    expect(claudeStateForWorktree([snap('awaiting'), snap('error'), snap('idle')])).toBe('awaiting');
  });

  it('prioritises error over idle when no session is running or awaiting', () => {
    expect(claudeStateForWorktree([snap('error'), snap('idle'), snap('exited')])).toBe('error');
  });
});
```

### Step 3.2: Implementación

`src/main/claude/rollup.ts`:

```ts
import type { ClaudeState } from '@shared/project';
import type { SessionSnapshot, SessionStatus } from '@shared/session';

const RUNNING: ReadonlySet<SessionStatus> = new Set(['starting', 'requesting', 'streaming']);

/**
 * Phase 4 roll-up rule: running > awaiting > error > idle.
 * Where "running" covers starting/requesting/streaming — anything where
 * the user should see a pulsing dot. `exited` is treated as idle.
 */
export function claudeStateForWorktree(snapshots: readonly SessionSnapshot[]): ClaudeState {
  let hasAwaiting = false;
  let hasError = false;
  for (const s of snapshots) {
    if (RUNNING.has(s.status)) return 'running';
    if (s.status === 'awaiting') hasAwaiting = true;
    else if (s.status === 'error') hasError = true;
  }
  if (hasAwaiting) return 'awaiting';
  if (hasError) return 'error';
  return 'idle';
}
```

### Step 3.3: Verify + commit

```bash
pnpm test -- --run tests/unit/main/claude/rollup.test.ts
git add src/main/claude/rollup.ts tests/unit/main/claude/rollup.test.ts
git commit -m "$(cat <<'EOF'
feat(claude): worktree state roll-up over multiple sessions

claudeStateForWorktree folds the list of SessionSnapshot statuses into
a single ClaudeState following the phase-4 rule:
running > awaiting > error > idle. The "running" bucket covers
starting/requesting/streaming so the StatusDot pulses whenever any
session is actively talking to the model. Exited sessions count as idle.

Pure function with no I/O — the StatusDot wiring lands once
SessionManager exposes the list.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 4: Persistence module

**Files:**
- Create: `src/main/claude/persistence.ts`
- Create: `tests/unit/main/claude/persistence.test.ts`

### Step 4.1: Failing tests (roundtrip)

`tests/unit/main/claude/persistence.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore, type JideStore } from '../../../../src/main/store/index';
import {
  loadAllSessions,
  saveSessionsForWorktree,
  clearSessionsForWorktree,
} from '../../../../src/main/claude/persistence';
import type { PersistedSession } from '@shared/session';

function makeSnap(uuid: string, worktreeId: string, title: string): PersistedSession {
  return {
    id: { worktreeId, uuid },
    status: 'idle',
    model: 'sonnet',
    cwd: '/tmp',
    title,
    createdAt: 1_700_000_000_000,
    messages: [],
    rateLimit: null,
    awaitingToolUseId: null,
    totalCostUsd: 0.0042,
  };
}

let store: JideStore;
let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'jide-persist-'));
  store = createStore({ cwd });
});

describe('session persistence', () => {
  it('returns an empty map when no sessions have been saved', () => {
    expect(loadAllSessions(store)).toEqual({});
  });

  it('roundtrips a list of sessions per worktree', () => {
    const a = makeSnap('aaa', 'wt-1', 'Session A');
    const b = makeSnap('bbb', 'wt-1', 'Session B');
    saveSessionsForWorktree(store, 'wt-1', [a, b]);
    expect(loadAllSessions(store)).toEqual({ 'wt-1': [a, b] });

    const c = makeSnap('ccc', 'wt-2', 'Session C');
    saveSessionsForWorktree(store, 'wt-2', [c]);
    expect(loadAllSessions(store)).toEqual({ 'wt-1': [a, b], 'wt-2': [c] });
  });

  it('clearing a worktree removes its entry without touching others', () => {
    saveSessionsForWorktree(store, 'wt-1', [makeSnap('aaa', 'wt-1', 'A')]);
    saveSessionsForWorktree(store, 'wt-2', [makeSnap('bbb', 'wt-2', 'B')]);
    clearSessionsForWorktree(store, 'wt-1');
    expect(loadAllSessions(store)).toEqual({ 'wt-2': [makeSnap('bbb', 'wt-2', 'B')] });
  });

  it('saving an empty list deletes the worktree key', () => {
    saveSessionsForWorktree(store, 'wt-1', [makeSnap('aaa', 'wt-1', 'A')]);
    saveSessionsForWorktree(store, 'wt-1', []);
    expect(loadAllSessions(store)).toEqual({});
  });
});
```

> The `createStore` import expects a CWD-overridable factory. Phase 1 already exposes `createStore({ cwd })` for tests — confirm signature when implementing; if it's `createStore(opts?: { cwd?: string })`, the call site here matches.

### Step 4.2: Implementación

`src/main/claude/persistence.ts`:

```ts
import type { JideStore } from '../store/index.js';
import type { PersistedSession } from '@shared/session';

/**
 * Read the persisted-sessions map from the store. Returns an empty
 * object if the key is missing (first launch, or after `electron-store`
 * resets via JIDE_TEST_STORE_CWD).
 */
export function loadAllSessions(store: JideStore): Record<string, PersistedSession[]> {
  return store.get('sessions') ?? {};
}

/** Overwrite the list of sessions for one worktree. Empty list removes the key. */
export function saveSessionsForWorktree(
  store: JideStore,
  worktreeId: string,
  sessions: PersistedSession[],
): void {
  const all = { ...loadAllSessions(store) };
  if (sessions.length === 0) {
    delete all[worktreeId];
  } else {
    all[worktreeId] = sessions;
  }
  store.set('sessions', all);
}

/** Convenience: drop a worktree's persisted sessions entirely (e.g. when project removed). */
export function clearSessionsForWorktree(store: JideStore, worktreeId: string): void {
  saveSessionsForWorktree(store, worktreeId, []);
}
```

### Step 4.3: Verify + commit

```bash
pnpm test -- --run tests/unit/main/claude/persistence.test.ts
git add src/main/claude/persistence.ts tests/unit/main/claude/persistence.test.ts
git commit -m "$(cat <<'EOF'
feat(claude): persistence layer for session snapshots

loadAllSessions / saveSessionsForWorktree / clearSessionsForWorktree
wrap the electron-store `sessions` key with idempotent semantics:
saving an empty list deletes the worktree entry, and read on a fresh
store returns {} not undefined. Isolated here so SessionManager and
the boot/quit lifecycle wiring can stay free of store shape details.

Tested via roundtrip with a real electron-store backed by a tmp dir
(JIDE_TEST_STORE_CWD pattern reused from phase 1).

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 5: ClaudeSession — rename, createdAt, rehydrate, resume

**Files:**
- Modify: `src/main/claude/session.ts`
- Modify: `tests/unit/main/claude/session.test.ts` (existing — confirm path)
- Create: `tests/unit/main/claude/session-rehydrate.test.ts`

### Step 5.1: Añadir `title`, `createdAt`, `rename`, `rehydrate()`

Modificar `src/main/claude/session.ts`:

1. Cambiar `ClaudeSessionOptions` para aceptar opcionalmente `seed?: PersistedSession`:

```ts
export interface ClaudeSessionOptions {
  worktreeId: string;
  cwd: string;
  model?: string;
  argsBuilder?: (sessionUuid: string, model: string) => string[];
  /** When provided, the session boots in a rehydrated state with the prior snapshot. */
  seed?: PersistedSession;
}
```

2. En el constructor (`src/main/claude/session.ts:69-78`), inicializar desde seed cuando exista:

```ts
constructor(opts: ClaudeSessionOptions) {
  super();
  this.opts = opts;
  this.model = opts.seed?.model ?? opts.model ?? 'sonnet';
  if (opts.seed) {
    this.sessionId = opts.seed.id;
    this.snapshotState = opts.seed;
    // Rehydrated: process is not alive yet, but the snapshot is real.
    // Mark terminated so the next send() goes through start() (which
    // resets terminated=false and spawns with --resume).
    this.terminated = true;
    this.rehydrated = true;
  } else {
    this.sessionId = { worktreeId: opts.worktreeId, uuid: randomUUID() };
    this.snapshotState = {
      ...emptySnapshot(opts.worktreeId, this.model, opts.cwd),
      id: this.sessionId,
    };
  }
}
```

3. Añadir el flag `rehydrated` y `title` y la mecánica de `emptySnapshot` para incluir `title`/`createdAt`. Modificar `emptySnapshot` en `protocol.ts` (o donde viva — buscar en el código) para que devuelva:

```ts
export function emptySnapshot(worktreeId: string, model: string, cwd: string): SessionSnapshot {
  return {
    id: { worktreeId, uuid: '' }, // overridden by caller
    status: 'idle',
    model,
    cwd,
    title: '',          // populated on first send() via inferTitle
    createdAt: Date.now(),
    messages: [],
    rateLimit: null,
    awaitingToolUseId: null,
    totalCostUsd: 0,
  };
}
```

4. En `start()`, cuando es rehidratado, pasar `--resume` en lugar de `--session-id`:

```ts
function defaultArgs(sessionUuid: string, model: string, resume: boolean): string[] {
  const base = [
    '-p',
    '--verbose',
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
    '--model', model,
    '--permission-mode', 'bypassPermissions',
  ];
  if (resume) base.push('--resume', sessionUuid);
  else base.push('--session-id', sessionUuid);
  return base;
}
```

Y en `start()`:

```ts
const resume = this.rehydrated;
const builder = this.opts.argsBuilder ?? ((uuid, model) => defaultArgs(uuid, model, resume));
const args = builder(this.sessionId.uuid, this.model);
this.proc = spawn(claudeBinary(), args, { ... });
// After spawn, clear rehydrated so a subsequent kill→start cycle uses --session-id again.
this.rehydrated = false;
```

5. Añadir método `rename(title: string)`:

```ts
rename(title: string): void {
  const trimmed = title.trim();
  this.updateSnapshot({ ...this.snapshotState, title: trimmed });
}
```

6. En `send()`, si `snapshot.title === ''`, inferir título del texto antes de añadir el mensaje:

```ts
send(text: string): void {
  // ... existing termination guards ...
  const wantsTitle = this.snapshotState.title === '';
  // ... existing send body, but when building nextSnapshot include title update if wantsTitle:
  const nextTitle = wantsTitle ? inferTitle(text) || this.snapshotState.title : this.snapshotState.title;
  this.updateSnapshot({
    ...this.snapshotState,
    status: 'requesting',
    title: nextTitle,
    messages: [ ...messages, { type: 'user', ... } ],
  });
}
```

Importar `inferTitle` desde `./title.js`.

### Step 5.2: Tests de rehydrate

`tests/unit/main/claude/session-rehydrate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ClaudeSession } from '../../../../src/main/claude/session';
import type { PersistedSession } from '@shared/session';

const SEED: PersistedSession = {
  id: { worktreeId: 'wt-1', uuid: 'seed-uuid' },
  status: 'idle',
  model: 'sonnet',
  cwd: '/tmp',
  title: 'Rehydrated session',
  createdAt: 1_700_000_000_000,
  messages: [
    { type: 'user', id: 'u-0', text: 'previous turn', ts: 0 },
    { type: 'claude', id: 'c-0', text: 'previous reply', ts: 1 },
  ],
  rateLimit: null,
  awaitingToolUseId: null,
  totalCostUsd: 0.0123,
};

describe('ClaudeSession (rehydrated)', () => {
  it('returns the seeded snapshot before any send', () => {
    const s = new ClaudeSession({ worktreeId: 'wt-1', cwd: '/tmp', seed: SEED });
    const snap = s.snapshot();
    expect(snap.id.uuid).toBe('seed-uuid');
    expect(snap.title).toBe('Rehydrated session');
    expect(snap.messages).toHaveLength(2);
    expect(snap.totalCostUsd).toBeCloseTo(0.0123);
  });

  it('preserves the session uuid across rehydrate (does NOT mint a new one on start)', () => {
    const s = new ClaudeSession({
      worktreeId: 'wt-1',
      cwd: '/tmp',
      seed: SEED,
      argsBuilder: () => ['--script', 'noop'], // prevent real spawn
    });
    // Don't actually spawn — just check the snapshot uuid is stable
    expect(s.snapshot().id.uuid).toBe('seed-uuid');
  });
});

describe('ClaudeSession.rename', () => {
  it('updates the title and emits a snapshot', () => {
    const s = new ClaudeSession({ worktreeId: 'wt-1', cwd: '/tmp' });
    let observed = '';
    s.on('snapshot', (snap) => {
      observed = snap.title;
    });
    s.rename('  My new title  ');
    expect(s.snapshot().title).toBe('My new title');
    expect(observed).toBe('My new title');
  });
});
```

### Step 5.3: Verify + commit

```bash
pnpm test -- --run tests/unit/main/claude/
git add src/main/claude/session.ts src/main/claude/protocol.ts tests/unit/main/claude/session-rehydrate.test.ts
git commit -m "$(cat <<'EOF'
feat(claude): session title, rehydrate, and --resume on persisted sessions

ClaudeSession gains a `title` field on its snapshot (auto-inferred via
inferTitle() on the first send, renamable via rename()) and a stable
`createdAt`. The new `seed: PersistedSession` constructor option boots
a session in rehydrated state — uuid pinned, messages restored,
process not alive — so a follow-up send() spawns the CLI with
`--resume <uuid>` instead of minting a fresh one. The flag clears
after the first spawn so kill→start cycles fall back to --session-id
semantics on the same uuid.

emptySnapshot now seeds title='' and createdAt=Date.now() so renderers
can rely on the field always existing.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 6: SessionManager — cap configurable, lookups, list events, persist/rehydrate hooks

**Files:**
- Modify: `src/main/claude/manager.ts`
- Modify: `tests/unit/main/claude/manager.test.ts` (existing — confirm)

### Step 6.1: Reescribir manager.ts

Modificar `src/main/claude/manager.ts` (replace todo el contenido):

```ts
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
   * Throws when the cap is reached — the renderer must inspect the list first.
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
   * Rehydrate a previously persisted session. Does NOT count toward the cap
   * if it would exceed it — rehydration always succeeds so the user does not
   * lose history when the cap is lowered.
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

  /** Drops the session from the manager's internal map (called from session 'exit' wiring). */
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

  /** For tests: list active worktree ids. */
  activeWorktrees(): string[] {
    return [...this.sessionsByWt.keys()];
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
```

### Step 6.2: Update tests

Modificar/extender `tests/unit/main/claude/manager.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SessionManager, SessionCapReachedError } from '../../../../src/main/claude/manager';

describe('SessionManager', () => {
  it('clamps the cap to [1,16] and defaults to 4', () => {
    expect(new SessionManager().getMaxPerWorktree()).toBe(4);
    expect(new SessionManager({ maxSessionsPerWorktree: 0 }).getMaxPerWorktree()).toBe(1);
    expect(new SessionManager({ maxSessionsPerWorktree: 100 }).getMaxPerWorktree()).toBe(16);
  });

  it('createForWorktree creates a new session every call up to the cap', () => {
    const mgr = new SessionManager({ maxSessionsPerWorktree: 2 });
    const a = mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    const b = mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    expect(a).not.toBe(b);
    expect(mgr.listForWorktree('wt-1')).toHaveLength(2);
  });

  it('throws SessionCapReachedError when over the cap', () => {
    const mgr = new SessionManager({ maxSessionsPerWorktree: 1 });
    mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    expect(() => mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' }))
      .toThrowError(SessionCapReachedError);
  });

  it('getById finds the session by uuid', () => {
    const mgr = new SessionManager();
    const s = mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    const uuid = s.snapshot().id.uuid;
    expect(mgr.getById('wt-1', uuid)).toBe(s);
    expect(mgr.getById('wt-1', 'missing')).toBeNull();
  });

  it('emits list-changed when a session is created', () => {
    const mgr = new SessionManager();
    const events: number[] = [];
    mgr.on('list-changed', (payload: { sessions: unknown[] }) => events.push(payload.sessions.length));
    mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    expect(events).toEqual([1, 2]);
  });

  it('rehydrate bypasses the cap so history is never lost', () => {
    const mgr = new SessionManager({ maxSessionsPerWorktree: 1 });
    mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    const seed = {
      id: { worktreeId: 'wt-1', uuid: 'seed' },
      status: 'idle' as const,
      model: 'sonnet',
      cwd: '/tmp',
      title: 't',
      createdAt: 0,
      messages: [],
      rateLimit: null,
      awaitingToolUseId: null,
      totalCostUsd: 0,
    };
    expect(() =>
      mgr.rehydrate({ worktreeId: 'wt-1', cwd: '/tmp', seed }),
    ).not.toThrow();
    expect(mgr.listForWorktree('wt-1')).toHaveLength(2);
  });
});
```

### Step 6.3: Verify + commit

```bash
pnpm test -- --run tests/unit/main/claude/manager.test.ts
git add src/main/claude/manager.ts tests/unit/main/claude/manager.test.ts
git commit -m "$(cat <<'EOF'
feat(claude): multi-session manager with configurable cap and rehydration

SessionManager.createForWorktree now creates a fresh session each call
up to maxSessionsPerWorktree (default 4, configurable, clamped to
1..16). Cap overflow raises SessionCapReachedError so the IPC layer
can surface it as a typed failure. New methods: getById, listForWorktree,
snapshotsForWorktree, killById, rehydrate (bypasses the cap so reducing
maxSessionsPerWorktree never drops history on the floor).

Each session's snapshot now triggers two emissions: 'snapshot'
(unchanged, for the per-session IPC fan-out) and 'list-changed'
(new, payload {worktreeId, sessions[]}) for the SessionStrip refresh.

Phase 3's startForWorktree is gone — sessions:create is now the sole
entry point and is always explicit about creating vs. fetching.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 7: IPC handlers + main lifecycle (boot rehydrate, quit persist)

**Files:**
- Modify: `src/main/ipc/sessions.ts`
- Modify: `src/main/ipc/index.ts`
- Modify: `src/main/index.ts`

### Step 7.1: Rewrite `src/main/ipc/sessions.ts`

```ts
import { createHandler } from './register.js';
import { sendEvent } from './events.js';
import type { ProjectRegistry } from '../projects/index.js';
import type { JideStore } from '../store/index.js';
import { SessionCapReachedError, type SessionManager } from '../claude/manager.js';
import type { SessionSnapshot } from '@shared/session';

function resolveWorktreeCwd(registry: ProjectRegistry, worktreeId: string): string {
  const sep = worktreeId.indexOf(':');
  if (sep < 0) throw new Error(`Bad worktree id: ${worktreeId}`);
  const repoRoot = worktreeId.slice(0, sep);
  const worktreePath = worktreeId.slice(sep + 1);
  const known = registry.list().some((p) => p.path === repoRoot);
  if (!known) {
    throw new Error(`Worktree ${worktreeId} does not belong to a registered project`);
  }
  return worktreePath;
}

export function registerSessions(
  registry: ProjectRegistry,
  manager: SessionManager,
  store: JideStore,
): void {
  manager.on('snapshot', (snap: SessionSnapshot) => {
    sendEvent('sessions:event', { worktreeId: snap.id.worktreeId, snapshot: snap });
  });

  manager.on('list-changed', (payload: { worktreeId: string; sessions: SessionSnapshot[] }) => {
    sendEvent('sessions:list-changed', payload);
  });

  createHandler('sessions:list', ({ worktreeId }) => {
    return Promise.resolve(manager.snapshotsForWorktree(worktreeId));
  });

  createHandler('sessions:create', ({ worktreeId }) => {
    const cwd = resolveWorktreeCwd(registry, worktreeId);
    try {
      const session = manager.createForWorktree({ worktreeId, cwd });
      return Promise.resolve(session.snapshot());
    } catch (err) {
      if (err instanceof SessionCapReachedError) {
        // Re-throw as a plain Error with a stable message — the
        // renderer parses the `SESSION_CAP_REACHED` prefix for UX.
        return Promise.reject(new Error(`SESSION_CAP_REACHED: ${err.cap}`));
      }
      throw err;
    }
  });

  createHandler('sessions:send', ({ worktreeId, sessionId, text }) => {
    const session = manager.getById(worktreeId, sessionId);
    if (!session) {
      return Promise.reject(new Error(`Session ${sessionId} not found in ${worktreeId}`));
    }
    session.send(text);
    return Promise.resolve();
  });

  createHandler('sessions:kill', ({ worktreeId, sessionId }) => {
    manager.killById(worktreeId, sessionId);
    return Promise.resolve();
  });

  createHandler('sessions:get', ({ worktreeId, sessionId }) => {
    const s = manager.getById(worktreeId, sessionId);
    return Promise.resolve(s ? s.snapshot() : null);
  });

  createHandler('sessions:approve-tool', () => {
    // Phase 3 stub — Phase 4 inherits behaviour (bypassPermissions).
    return Promise.resolve();
  });

  createHandler('sessions:rename', ({ worktreeId, sessionId, title }) => {
    const s = manager.getById(worktreeId, sessionId);
    if (s) s.rename(title);
    return Promise.resolve();
  });

  createHandler('sessions:set-active', ({ worktreeId, sessionId }) => {
    const map = store.get('activeSessionByWt') ?? {};
    store.set('activeSessionByWt', { ...map, [worktreeId]: sessionId });
    return Promise.resolve();
  });

  createHandler('sessions:get-active', ({ worktreeId }) => {
    const map = store.get('activeSessionByWt') ?? {};
    return Promise.resolve(map[worktreeId] ?? null);
  });
}
```

### Step 7.2: Wire en `src/main/ipc/index.ts`

Confirmar que `IpcDeps` ya expone `store`. Pasarlo a `registerSessions`:

```ts
registerSessions(deps.registry, deps.manager, deps.store);
```

### Step 7.3: Boot — rehydrate antes de wire renderers

Modificar `src/main/index.ts` después de crear `manager`:

```ts
import { loadAllSessions, saveSessionsForWorktree } from './claude/persistence.js';

// ... inside whenReady() ...
manager = new SessionManager({
  maxSessionsPerWorktree: store.get('maxSessionsPerWorktree') ?? 4,
});

// Rehydrate sessions persisted by a prior run.
const persisted = loadAllSessions(store);
for (const [worktreeId, sessions] of Object.entries(persisted)) {
  for (const seed of sessions) {
    // cwd is captured in the snapshot — use it as-is. If the worktree
    // no longer exists on disk, the session shows up but a follow-up
    // send() will surface the error.
    manager.rehydrate({ worktreeId, cwd: seed.cwd, seed });
  }
}
```

### Step 7.4: Quit — persist active snapshots

Modificar `src/main/index.ts:54-57`:

```ts
app.on('before-quit', () => {
  // Snapshot every session per worktree, then kill the procs.
  if (manager) {
    const wts = manager.activeWorktrees();
    for (const wt of wts) {
      const snaps = manager.snapshotsForWorktree(wt);
      // Drop exited sessions older than 0 messages — keep history of those that talked.
      const toPersist = snaps.filter((s) => s.messages.length > 0);
      saveSessionsForWorktree(/* store reference, captured in closure */ STORE_REF, wt, toPersist);
    }
    manager.killAll();
  }
});
```

> **Implementation note:** `STORE_REF` needs to be hoisted to module scope or captured in a closure — re-read `src/main/index.ts` lines 22-48 and decide the cleanest seam. Option A: hoist `store` to a `let store: JideStore | null = null` outside `whenReady()`, assign inside. Option B: stash both `store` and `manager` on a shared object. Option A wins on simplicity.

### Step 7.5: Verify + commit

```bash
pnpm typecheck && pnpm lint
git add src/main/ipc/sessions.ts src/main/ipc/index.ts src/main/index.ts
git commit -m "$(cat <<'EOF'
feat(ipc): multi-session sessions:* handlers and persistence lifecycle

The sessions handler rewrites against the (worktreeId, sessionId)
contract: sessions:list/create/send/kill/get/rename/set-active/get-active
all route via SessionManager.getById, with cap overflow surfaced to the
renderer as a SESSION_CAP_REACHED-prefixed error so the SessionStrip
can disable the + button accordingly. set-active/get-active persist
the per-worktree active session uuid in the store.

App boot now calls loadAllSessions() and rehydrates each persisted
snapshot via manager.rehydrate (which bypasses the cap). before-quit
persists every session that has at least one message back to the store
before killAll. Sessions with empty message lists are dropped — they
add noise to the SessionStrip on relaunch.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 8: Renderer — `useSessionsList` and reshape `useSession`

**Files:**
- Create: `src/renderer/src/shortcuts/useSessionsList.ts`
- Modify: `src/renderer/src/shortcuts/useSession.ts`

### Step 8.1: `useSessionsList`

`src/renderer/src/shortcuts/useSessionsList.ts`:

```ts
import { useEffect, useState, useCallback } from 'react';
import type { SessionSnapshot } from '@shared/session';

export interface UseSessionsList {
  sessions: SessionSnapshot[];
  activeId: string | null;
  setActive: (sessionId: string) => Promise<void>;
  create: () => Promise<SessionSnapshot | null>;
  rename: (sessionId: string, title: string) => Promise<void>;
  kill: (sessionId: string) => Promise<void>;
  capReached: boolean;
}

export function useSessionsList(worktreeId: string | null, max: number): UseSessionsList {
  const [sessions, setSessions] = useState<SessionSnapshot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Hydrate on worktree change.
  useEffect(() => {
    if (!worktreeId) {
      setSessions([]);
      setActiveId(null);
      return;
    }
    let alive = true;
    void Promise.all([
      window.jide.sessions.list(worktreeId),
      window.jide.sessions.getActive(worktreeId),
    ]).then(([list, active]) => {
      if (!alive) return;
      setSessions(list);
      setActiveId(active ?? (list[0]?.id.uuid ?? null));
    });
    const off = window.jide.on('sessions:list-changed', (payload) => {
      if (payload.worktreeId !== worktreeId) return;
      setSessions(payload.sessions);
    });
    return () => {
      alive = false;
      off();
    };
  }, [worktreeId]);

  const setActive = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!worktreeId) return;
      setActiveId(sessionId);
      await window.jide.sessions.setActive(worktreeId, sessionId);
    },
    [worktreeId],
  );

  const create = useCallback(async (): Promise<SessionSnapshot | null> => {
    if (!worktreeId) return null;
    try {
      const snap = await window.jide.sessions.create(worktreeId);
      await window.jide.sessions.setActive(worktreeId, snap.id.uuid);
      setActiveId(snap.id.uuid);
      return snap;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('SESSION_CAP_REACHED')) return null;
      throw err;
    }
  }, [worktreeId]);

  const rename = useCallback(
    async (sessionId: string, title: string): Promise<void> => {
      if (!worktreeId) return;
      await window.jide.sessions.rename(worktreeId, sessionId, title);
    },
    [worktreeId],
  );

  const kill = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!worktreeId) return;
      await window.jide.sessions.kill(worktreeId, sessionId);
      // If the killed one was active, fall through to the next one (or null).
      if (sessionId === activeId) {
        const remaining = sessions.filter((s) => s.id.uuid !== sessionId);
        const next = remaining[0]?.id.uuid ?? null;
        setActiveId(next);
        if (next) await window.jide.sessions.setActive(worktreeId, next);
      }
    },
    [worktreeId, activeId, sessions],
  );

  const capReached = sessions.length >= max;

  return { sessions, activeId, setActive, create, rename, kill, capReached };
}
```

### Step 8.2: Cambiar `useSession` para tomar `sessionUuid`

Modificar `src/renderer/src/shortcuts/useSession.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import type { SessionSnapshot } from '@shared/session';

export interface UseSession {
  snapshot: SessionSnapshot | null;
  send: (text: string) => Promise<void>;
  kill: () => Promise<void>;
  approveTool: (toolUseId: string, allow: boolean, reason?: string) => Promise<void>;
}

export function useSession(worktreeId: string | null, sessionId: string | null): UseSession {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);

  useEffect(() => {
    if (!worktreeId || !sessionId) {
      setSnapshot(null);
      return;
    }
    let alive = true;
    window.jide.sessions
      .get(worktreeId, sessionId)
      .then((s) => {
        if (alive) setSnapshot(s);
      })
      .catch((err: unknown) => {
        console.error('[jide] sessions:get failed', err);
      });
    const off = window.jide.on('sessions:event', (payload) => {
      if (payload.worktreeId !== worktreeId) return;
      if (payload.snapshot.id.uuid !== sessionId) return;
      setSnapshot(payload.snapshot);
    });
    return () => {
      alive = false;
      off();
    };
  }, [worktreeId, sessionId]);

  const send = useCallback(
    async (text: string): Promise<void> => {
      if (!worktreeId || !sessionId) return;
      await window.jide.sessions.send(worktreeId, sessionId, text);
    },
    [worktreeId, sessionId],
  );

  const kill = useCallback(async (): Promise<void> => {
    if (!worktreeId || !sessionId) return;
    await window.jide.sessions.kill(worktreeId, sessionId);
  }, [worktreeId, sessionId]);

  const approveTool = useCallback(
    async (toolUseId: string, allow: boolean, reason?: string): Promise<void> => {
      if (!worktreeId || !sessionId) return;
      await window.jide.sessions.approveTool(worktreeId, sessionId, toolUseId, allow, reason);
    },
    [worktreeId, sessionId],
  );

  return { snapshot, send, kill, approveTool };
}
```

### Step 8.3: Verify + commit

```bash
pnpm typecheck
git add src/renderer/src/shortcuts/useSessionsList.ts src/renderer/src/shortcuts/useSession.ts
git commit -m "$(cat <<'EOF'
feat(renderer): useSessionsList hook and session-keyed useSession

useSessionsList(worktreeId, max) subscribes to sessions:list-changed,
hydrates from sessions:list + sessions:get-active on mount, and exposes
create/setActive/rename/kill plus a capReached boolean for the
SessionStrip's + button. create() catches SESSION_CAP_REACHED and
returns null instead of throwing so the UI can short-circuit cleanly.

useSession now takes (worktreeId, sessionId) and filters
sessions:event by uuid so each ChatPanel only re-renders for its own
session. The previous single-session-per-worktree assumption is gone.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 9: `SessionChip` component (with inline rename)

**Files:**
- Create: `src/renderer/src/components/Chat/SessionChip.tsx`
- Create: `tests/unit/renderer/SessionChip.test.tsx` (optional — snapshot/behaviour test)

### Step 9.1: Componente

`src/renderer/src/components/Chat/SessionChip.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react';
import type { SessionSnapshot } from '@shared/session';

export interface SessionChipProps {
  snapshot: SessionSnapshot;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onClose: () => void;
}

export function SessionChip({ snapshot, active, onSelect, onRename, onClose }: SessionChipProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(snapshot.title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setDraft(snapshot.title);
  }, [snapshot.title]);

  const commit = (): void => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== snapshot.title) onRename(trimmed);
    setEditing(false);
  };

  const cancel = (): void => {
    setDraft(snapshot.title);
    setEditing(false);
  };

  const statusColor =
    snapshot.status === 'starting' || snapshot.status === 'requesting' || snapshot.status === 'streaming'
      ? '#F95A5C'
      : snapshot.status === 'awaiting'
      ? '#F59E0B'
      : snapshot.status === 'error'
      ? '#ED5A46'
      : '#B8B8B8';

  return (
    <div
      data-testid={`session-chip-${snapshot.id.uuid}`}
      data-active={active}
      role="tab"
      aria-selected={active}
      onClick={editing ? undefined : onSelect}
      onDoubleClick={() => setEditing(true)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: active ? '#000000' : '#00000008',
        color: active ? '#FFFFFF' : '#000000B0',
        fontSize: 12,
        cursor: editing ? 'text' : 'pointer',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: 999,
          background: statusColor,
          animation:
            snapshot.status === 'starting' || snapshot.status === 'requesting' || snapshot.status === 'streaming'
              ? 'jidePulse 1.6s ease-out infinite'
              : 'none',
        }}
      />
      {editing ? (
        <input
          ref={inputRef}
          data-testid={`session-chip-rename-${snapshot.id.uuid}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') cancel();
            e.stopPropagation();
          }}
          maxLength={32}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
            width: Math.max(40, draft.length * 7),
          }}
        />
      ) : (
        <span>{snapshot.title || 'Sin título'}</span>
      )}
      {!editing && active && (
        <button
          type="button"
          data-testid={`session-chip-close-${snapshot.id.uuid}`}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Cerrar sesión"
          style={{
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            padding: 0,
            opacity: 0.7,
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
```

### Step 9.2: Verify + commit

```bash
pnpm typecheck && pnpm lint
git add src/renderer/src/components/Chat/SessionChip.tsx
git commit -m "$(cat <<'EOF'
feat(chat): SessionChip with status dot, inline rename, and close affordance

A presentational chip for a single session: shows a colour-coded
status dot (pulsing on running statuses), the session title, and a
close × that only renders when the chip is active. Double-click enters
edit mode — focus + select all, Enter commits (only if trimmed and
changed), Escape or blur cancels. Click-to-select is suppressed in
edit mode so typing in the input doesn't re-trigger onSelect.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 10: `SessionStrip` component

**Files:**
- Create: `src/renderer/src/components/Chat/SessionStrip.tsx`

### Step 10.1: Componente

`src/renderer/src/components/Chat/SessionStrip.tsx`:

```tsx
import type { SessionSnapshot } from '@shared/session';
import { SessionChip } from './SessionChip';

export interface SessionStripProps {
  sessions: SessionSnapshot[];
  activeId: string | null;
  capReached: boolean;
  onSelect: (sessionId: string) => void;
  onRename: (sessionId: string, title: string) => void;
  onClose: (sessionId: string) => void;
  onNew: () => void;
}

export function SessionStrip({
  sessions,
  activeId,
  capReached,
  onSelect,
  onRename,
  onClose,
  onNew,
}: SessionStripProps) {
  return (
    <div
      data-testid="session-strip"
      role="tablist"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderBottom: '1px solid #00000010',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
      }}
    >
      {sessions.map((s) => (
        <SessionChip
          key={s.id.uuid}
          snapshot={s}
          active={s.id.uuid === activeId}
          onSelect={() => onSelect(s.id.uuid)}
          onRename={(title) => onRename(s.id.uuid, title)}
          onClose={() => onClose(s.id.uuid)}
        />
      ))}
      <button
        type="button"
        data-testid="session-strip-new"
        disabled={capReached}
        onClick={onNew}
        aria-label="Nueva sesión (⌘T)"
        title={capReached ? 'Cap alcanzado' : 'Nueva sesión (⌘T)'}
        style={{
          marginLeft: 4,
          padding: '4px 10px',
          borderRadius: 999,
          border: '1px dashed #00000030',
          background: 'transparent',
          color: capReached ? '#00000040' : '#000000B0',
          cursor: capReached ? 'not-allowed' : 'pointer',
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        + Nueva
      </button>
    </div>
  );
}
```

### Step 10.2: Verify + commit

```bash
pnpm typecheck
git add src/renderer/src/components/Chat/SessionStrip.tsx
git commit -m "$(cat <<'EOF'
feat(chat): SessionStrip — horizontal scroll of session chips + new button

Renders one SessionChip per snapshot in declared order, with a
trailing "+ Nueva" button that disables when capReached. Horizontal
scroll handles overflow without wrapping; chips never shrink. The
strip is the sole owner of the layout — chip and button are siblings
under a single flex container so the keyboard tab order matches the
visual order.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 11: `SessionMeta` + `EmptySessions` + ChatPanel integration + ⌘T

**Files:**
- Create: `src/renderer/src/components/Chat/SessionMeta.tsx`
- Create: `src/renderer/src/components/Chat/EmptySessions.tsx`
- Create: `src/renderer/src/components/Chat/useSessionHotkey.ts`
- Modify: `src/renderer/src/components/Chat/ChatPanel.tsx`

### Step 11.1: `SessionMeta`

`src/renderer/src/components/Chat/SessionMeta.tsx`:

```tsx
import type { SessionSnapshot } from '@shared/session';

export interface SessionMetaProps {
  snapshot: SessionSnapshot;
}

/**
 * Phase 4 meta band: model + status + total cost.
 * Tokens / ctxPct are NOT in the Phase 3 snapshot — Phase 4 leaves
 * placeholders that read "—" until the protocol layer surfaces them
 * (tracked under Known issues at the bottom of this plan).
 */
export function SessionMeta({ snapshot }: SessionMetaProps) {
  return (
    <div
      data-testid="session-meta"
      style={{
        display: 'flex',
        gap: 12,
        padding: '4px 12px',
        fontSize: 11,
        color: '#00000080',
        fontFamily: 'ui-monospace, monospace',
        borderBottom: '1px solid #00000008',
        background: '#00000003',
      }}
    >
      <span data-testid="session-meta-model">model: {snapshot.model}</span>
      <span data-testid="session-meta-status">status: {snapshot.status}</span>
      <span data-testid="session-meta-tokens">tokens: —</span>
      <span data-testid="session-meta-ctx">ctx: —</span>
      <span data-testid="session-meta-cost">
        ${snapshot.totalCostUsd.toFixed(4)}
      </span>
    </div>
  );
}
```

### Step 11.2: `EmptySessions`

`src/renderer/src/components/Chat/EmptySessions.tsx`:

```tsx
export interface EmptySessionsProps {
  onCreate: () => void;
  disabled: boolean;
}

export function EmptySessions({ onCreate, disabled }: EmptySessionsProps) {
  return (
    <div
      data-testid="empty-sessions"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: '#00000060',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 13,
      }}
    >
      <p>No hay sesiones aún en este worktree.</p>
      <button
        type="button"
        data-testid="empty-sessions-cta"
        disabled={disabled}
        onClick={onCreate}
        style={{
          padding: '8px 16px',
          border: '1px solid #000000',
          borderRadius: 6,
          background: '#000000',
          color: '#FFFFFF',
          fontFamily: 'inherit',
          fontSize: 12,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        Nueva sesión <span style={{ opacity: 0.6 }}>⌘T</span>
      </button>
    </div>
  );
}
```

### Step 11.3: `useSessionHotkey`

`src/renderer/src/components/Chat/useSessionHotkey.ts`:

```ts
import { useEffect } from 'react';

/**
 * Registers a window-level keydown listener for ⌘T (or Ctrl+T on
 * non-mac). When fired with a worktree active, calls `onNew()`. Returns
 * a cleanup so the host component can mount/unmount safely.
 *
 * Note: the browser intercepts Ctrl+T to open a new tab in non-electron
 * contexts. In Electron's BrowserWindow we get the event before the
 * browser shortcut fires.
 */
export function useSessionHotkey(enabled: boolean, onNew: () => void): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent): void => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      if (e.key !== 't' && e.key !== 'T') return;
      // Don't hijack ⌘T while the user is typing inside a chip rename input.
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'INPUT') return;
      e.preventDefault();
      onNew();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, onNew]);
}
```

### Step 11.4: Reescribir `ChatPanel.tsx`

Esto unifica todo. Reemplaza el contenido de `src/renderer/src/components/Chat/ChatPanel.tsx` para:
- Llamar a `useSessionsList(worktreeId, max)` y luego a `useSession(worktreeId, activeId)`.
- Renderizar `SessionStrip` arriba, `SessionMeta` debajo del strip, `EmptySessions` si `sessions.length === 0`.
- Conectar `useSessionHotkey(worktreeId !== null, () => create())`.
- Mantener el header existente (status + kill), composer y approvalbar, pero apuntando a la sesión activa.

```tsx
import { useEffect, useRef } from 'react';
import type { Message as Msg } from '@shared/session';
import { Message } from './Message';
import { Composer } from './Composer';
import { ApprovalBar } from './ApprovalBar';
import { StreamingIndicator } from './StreamingIndicator';
import { SessionStrip } from './SessionStrip';
import { SessionMeta } from './SessionMeta';
import { EmptySessions } from './EmptySessions';
import { useSession } from '../../shortcuts/useSession';
import { useSessionsList } from '../../shortcuts/useSessionsList';
import { useSessionHotkey } from './useSessionHotkey';

const DEFAULT_MAX_SESSIONS = 4;

export interface ChatPanelProps {
  worktreeId: string | null;
  maxSessionsPerWorktree?: number;
}

export function ChatPanel({ worktreeId, maxSessionsPerWorktree = DEFAULT_MAX_SESSIONS }: ChatPanelProps) {
  const { sessions, activeId, setActive, create, rename, kill: killSession, capReached } =
    useSessionsList(worktreeId, maxSessionsPerWorktree);
  const { snapshot, send, approveTool, kill: killActive } = useSession(worktreeId, activeId);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [snapshot?.messages.length, snapshot?.status]);

  useSessionHotkey(worktreeId !== null && !capReached, () => {
    void create();
  });

  if (!worktreeId) {
    return (
      <main
        data-testid="chat-panel-empty"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#00000040',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 14,
        }}
      >
        Selecciona un worktree
      </main>
    );
  }

  return (
    <main
      data-testid="chat-panel"
      data-status={snapshot?.status ?? 'idle'}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      <SessionStrip
        sessions={sessions}
        activeId={activeId}
        capReached={capReached}
        onSelect={(id) => {
          void setActive(id);
        }}
        onRename={(id, title) => {
          void rename(id, title);
        }}
        onClose={(id) => {
          void killSession(id);
        }}
        onNew={() => {
          void create();
        }}
      />

      {sessions.length === 0 || !snapshot ? (
        <EmptySessions
          onCreate={() => {
            void create();
          }}
          disabled={capReached}
        />
      ) : (
        <>
          <SessionMeta snapshot={snapshot} />
          <ChatBody
            messages={snapshot.messages}
            status={snapshot.status}
            onKill={() => {
              killActive().catch((err: unknown) => {
                console.error('[jide] sessions:kill failed', err);
              });
            }}
            listRef={listRef}
          />
          <ApprovalBar
            awaitingToolUseId={snapshot.awaitingToolUseId ?? null}
            toolName={findPendingTool(snapshot.messages, snapshot.awaitingToolUseId)?.name ?? null}
            onApprove={(id) => {
              approveTool(id, true).catch((err: unknown) => {
                console.error('[jide] sessions:approve-tool failed', err);
              });
            }}
            onReject={(id, reason) => {
              approveTool(id, false, reason).catch((err: unknown) => {
                console.error('[jide] sessions:approve-tool failed', err);
              });
            }}
          />
          <Composer
            onSubmit={(text) => {
              send(text).catch((err: unknown) => {
                console.error('[jide] sessions:send failed', err);
              });
            }}
            disabled={!activeId || isBusy(snapshot.status)}
          />
        </>
      )}
    </main>
  );
}

function ChatBody({
  messages,
  status,
  onKill,
  listRef,
}: {
  messages: Msg[];
  status: string;
  onKill: () => void;
  listRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      <header
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #00000010',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: '#00000080',
        }}
      >
        <span data-testid="chat-status">{status}</span>
        <span style={{ flex: 1 }} />
        {isBusy(status) && (
          <button
            type="button"
            data-testid="chat-kill"
            onClick={onKill}
            style={{
              padding: '4px 10px',
              border: '1px solid #ED5A46',
              background: '#FFFFFF',
              color: '#ED5A46',
              borderRadius: 6,
              fontFamily: 'inherit',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Kill
          </button>
        )}
      </header>
      <div
        ref={listRef}
        data-testid="chat-messages"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}
        {isBusy(status) && <StreamingIndicator />}
      </div>
    </>
  );
}

function isBusy(status: string): boolean {
  return status === 'starting' || status === 'requesting' || status === 'streaming';
}

function findPendingTool(
  messages: Msg[],
  awaitingId: string | null | undefined,
): Extract<Msg, { type: 'tool' }> | null {
  if (!awaitingId) return null;
  for (const m of messages) {
    if (m.type === 'tool' && m.id === awaitingId) return m;
  }
  return null;
}
```

### Step 11.5: Pasar `maxSessionsPerWorktree` desde `App.tsx`

Modificar `src/renderer/src/App.tsx` (leer primero su contenido actual):
- Tras montar, leer `window.jide.settings.get('maxSessionsPerWorktree')` y pasarlo como prop a `<ChatPanel />`.

### Step 11.6: Verify + commit

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/renderer/src/components/Chat/ src/renderer/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(chat): ChatPanel renders SessionStrip + SessionMeta + EmptySessions; ⌘T wired

ChatPanel restructures around the (worktreeId, activeSessionId) model:
SessionStrip on top, SessionMeta band, then either EmptySessions (when
no sessions exist for the worktree) or the ChatBody + ApprovalBar +
Composer for the active snapshot. The hotkey ⌘T calls create() unless
the cap is reached. The strip exposes select, rename, close, and new.

SessionMeta surfaces model/status/cost; tokens/ctx are placeholders
because the Phase 3 protocol parser doesn't expose them yet (see
known issues at the bottom of the plan).

The maxSessionsPerWorktree prop flows in from App.tsx via
window.jide.settings.get so the cap stays a single source of truth.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 12: Worktree roll-up wiring → Sidebar StatusDot

**Files:**
- Modify: `src/main/projects/index.ts` (or whichever module owns `Worktree.claude` emission — confirm via grep)
- Modify: `src/main/index.ts`
- Create: `tests/unit/main/claude/manager-rollup.test.ts`

### Step 12.1: Listener en main que actualiza Worktree.claude

`src/main/projects/index.ts` ya emite `worktrees:status-changed`. Phase 4 añade un listener en `main/index.ts` que conecta `manager.on('list-changed')` con la actualización del campo `Worktree.claude`:

Modificar `src/main/index.ts` después de `manager = new SessionManager(...)`:

```ts
import { claudeStateForWorktree } from './claude/rollup.js';

manager.on('list-changed', ({ worktreeId, sessions }) => {
  const claudeState = claudeStateForWorktree(sessions);
  // Resolve project + worktree from worktreeId (format: `${repoRoot}:${worktreePath}`).
  const sep = worktreeId.indexOf(':');
  if (sep < 0) return;
  const repoRoot = worktreeId.slice(0, sep);
  const project = registry.list().find((p) => p.path === repoRoot);
  if (!project) return;
  // Re-fetch the worktree row with the updated claude field and broadcast.
  // The registry doesn't store worktree rows directly — we ask git/index.ts for
  // the list and patch the claude field for the changed one. Project's
  // watcher already emits the row; here we just override claude state.
  const path = worktreeId.slice(sep + 1);
  // Minimal: emit an overlay event that the renderer merges into its
  // existing worktrees:status-changed listener.
  sendEvent('worktrees:status-changed', {
    projectId: project.id,
    worktree: {
      id: worktreeId,
      branch: '',           // renderer keeps the previous values for fields it sees as empty
      path,
      head: '',
      status: 'clean' as const,
      claude: claudeState,
      changes: 0,
      ahead: 0,
      behind: 0,
    },
  });
});
```

> **Implementation detail:** the existing `worktrees:status-changed` payload sends the FULL `Worktree` object. Patching it partially requires either (a) the renderer to merge or (b) the main process to re-issue the full row. **(b) is cleaner** — re-read the git status before emitting. Inspect `src/main/git/index.ts` to find the existing `worktreeRow(projectPath, worktreePath)` helper or equivalent; if it doesn't exist as a named export, add a small helper and call it here.

Concretely:

```ts
import { createGitClient } from './git/index.js';

manager.on('list-changed', async ({ worktreeId, sessions }) => {
  const claudeState = claudeStateForWorktree(sessions);
  const sep = worktreeId.indexOf(':');
  if (sep < 0) return;
  const repoRoot = worktreeId.slice(0, sep);
  const worktreePath = worktreeId.slice(sep + 1);
  const project = registry.list().find((p) => p.path === repoRoot);
  if (!project) return;
  try {
    const git = createGitClient(project.path);
    const list = await git.listWorktrees(); // confirm exact name when implementing
    const row = list.find((w) => w.path === worktreePath);
    if (!row) return;
    sendEvent('worktrees:status-changed', {
      projectId: project.id,
      worktree: { ...row, claude: claudeState },
    });
  } catch (err) {
    console.error('[jide] roll-up emit failed', err);
  }
});
```

### Step 12.2: Test de integración del roll-up

`tests/unit/main/claude/manager-rollup.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SessionManager } from '../../../../src/main/claude/manager';
import { claudeStateForWorktree } from '../../../../src/main/claude/rollup';

describe('SessionManager → roll-up integration', () => {
  it('roll-up of an empty worktree is idle', () => {
    const mgr = new SessionManager();
    expect(claudeStateForWorktree(mgr.snapshotsForWorktree('wt-1'))).toBe('idle');
  });

  it('roll-up turns running when at least one session is streaming', () => {
    const mgr = new SessionManager();
    const a = mgr.createForWorktree({ worktreeId: 'wt-1', cwd: '/tmp' });
    // Force the snapshot status via the rename trick (only `title` mutates;
    // for status, exercise via the protected updateSnapshot indirectly).
    // Simplest: spy on the resulting state by reading the snapshot of session a
    // after a manual rename to make sure the manager is wired, then assert
    // claudeStateForWorktree responds to a synthetic snapshot.
    a.rename('streaming session');
    const snaps = mgr.snapshotsForWorktree('wt-1');
    expect(snaps).toHaveLength(1);
    // Synthesize a streaming snapshot externally for the roll-up assertion:
    expect(claudeStateForWorktree([{ ...snaps[0]!, status: 'streaming' }])).toBe('running');
  });
});
```

### Step 12.3: Verify + commit

```bash
pnpm test -- --run tests/unit/main/claude/ && pnpm typecheck
git add src/main/index.ts src/main/projects/index.ts tests/unit/main/claude/manager-rollup.test.ts
git commit -m "$(cat <<'EOF'
feat(claude): roll-up session statuses into Worktree.claude for the Sidebar

main/index.ts subscribes to manager.on('list-changed'), folds the
snapshots through claudeStateForWorktree, and re-emits the full
worktree row via worktrees:status-changed with `claude` overridden.
The renderer Sidebar already consumes that event and renders StatusDot
on Worktree.claude, so no renderer change is required for the
visualization — the pulse, the amber awaiting, the red error all
light up the moment any session in the worktree flips state.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 13: E2E — multi-session parallelism, persistence roundtrip, ⌘T

**Files:**
- Create: `tests/fixtures/claude-events/multi-session-a.script.json`
- Create: `tests/fixtures/claude-events/multi-session-b.script.json`
- Create: `tests/e2e/multi-session.spec.ts`

### Step 13.1: Scripts fake-claude

`tests/fixtures/claude-events/multi-session-a.script.json`:

```json
[
  { "kind": "echo-stdin" },
  { "kind": "emit", "delayMs": 30, "event": { "type": "system", "subtype": "init", "session_id": "fake-A" } },
  { "kind": "emit", "delayMs": 30, "event": { "type": "assistant", "message": { "id": "msg_A1", "content": [{ "type": "text", "text": "Reply from session A." }] } } },
  { "kind": "emit", "delayMs": 30, "event": { "type": "result", "subtype": "success", "is_error": false, "total_cost_usd": 0.0001 } },
  { "kind": "exit", "code": 0 }
]
```

`tests/fixtures/claude-events/multi-session-b.script.json`:

```json
[
  { "kind": "echo-stdin" },
  { "kind": "emit", "delayMs": 30, "event": { "type": "system", "subtype": "init", "session_id": "fake-B" } },
  { "kind": "emit", "delayMs": 30, "event": { "type": "assistant", "message": { "id": "msg_B1", "content": [{ "type": "text", "text": "Reply from session B." }] } } },
  { "kind": "emit", "delayMs": 30, "event": { "type": "result", "subtype": "success", "is_error": false, "total_cost_usd": 0.0002 } },
  { "kind": "exit", "code": 0 }
]
```

> **Important:** the exact event shapes must match what the protocol parser expects. Re-read `tests/fixtures/claude-events/e2e-greeting.script.json` (used by phase 3 E2E) and copy its envelope shape — the placeholders above are illustrative only.

### Step 13.2: E2E

`tests/e2e/multi-session.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execaSync } from 'execa';
import { launchJide } from './helpers/launch';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT_A = resolve(here, '../fixtures/claude-events/multi-session-a.script.json');

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'jide-e2e-multi-'));
  execaSync('git', ['init', '--initial-branch=main', dir]);
  execaSync('git', ['-C', dir, 'config', 'user.email', 'e2e@jide.local']);
  execaSync('git', ['-C', dir, 'config', 'user.name', 'e2e']);
  execaSync('git', ['-C', dir, 'config', 'commit.gpgsign', 'false']);
  execaSync('git', ['-C', dir, 'commit', '--allow-empty', '-m', 'init']);
  return dir;
}

test('multi-session: create two sessions, switch between them, see independent transcripts', async () => {
  const repoDir = initRepo();
  const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-multi-store-'));
  const app = await launchJide({ dialogReturnPath: repoDir, storeCwd, fakeClaudeScript: SCRIPT_A });
  const page = await app.firstWindow();

  await page.evaluate(() => window.jide.projects.add());
  await page.getByTestId('worktree-main').click();

  // Empty state → CTA to create the first session.
  await expect(page.getByTestId('empty-sessions')).toBeVisible();
  await page.getByTestId('empty-sessions-cta').click();

  // Strip now shows one chip; send a prompt.
  await expect(page.getByTestId('session-strip')).toBeVisible();
  await page.getByTestId('composer-input').fill('Hello A');
  await page.getByTestId('composer-input').press('Enter');
  await expect(page.locator('[data-testid^="message-claude-"]', { hasText: 'Reply from session A.' }))
    .toBeVisible({ timeout: 5000 });

  // Create a SECOND session via the strip's + button.
  await page.getByTestId('session-strip-new').click();
  await page.getByTestId('composer-input').fill('Hello B');
  await page.getByTestId('composer-input').press('Enter');
  await expect(page.locator('[data-testid^="message-claude-"]', { hasText: 'Reply from session A.' }))
    .toHaveCount(0); // we've switched — the A reply is no longer visible

  // Switch back to the first chip and verify its transcript is intact.
  const firstChip = page.locator('[data-testid^="session-chip-"]').first();
  await firstChip.click();
  await expect(page.locator('[data-testid^="message-claude-"]', { hasText: 'Reply from session A.' }))
    .toBeVisible();

  await app.close();
  rmSync(repoDir, { recursive: true, force: true });
  rmSync(storeCwd, { recursive: true, force: true });
});

test('multi-session: ⌘T hotkey creates a new session', async () => {
  const repoDir = initRepo();
  const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-multi-store-'));
  const app = await launchJide({ dialogReturnPath: repoDir, storeCwd, fakeClaudeScript: SCRIPT_A });
  const page = await app.firstWindow();
  await page.evaluate(() => window.jide.projects.add());
  await page.getByTestId('worktree-main').click();
  await page.getByTestId('empty-sessions-cta').click();
  await expect(page.locator('[data-testid^="session-chip-"]')).toHaveCount(1);

  // Send one prompt to anchor session A.
  await page.getByTestId('composer-input').fill('A');
  await page.getByTestId('composer-input').press('Enter');
  await expect(page.locator('[data-testid^="message-claude-"]').first()).toBeVisible({ timeout: 5000 });

  // ⌘T should add a second chip and switch focus to it.
  await page.keyboard.press('Meta+t');
  await expect(page.locator('[data-testid^="session-chip-"]')).toHaveCount(2);

  await app.close();
  rmSync(repoDir, { recursive: true, force: true });
  rmSync(storeCwd, { recursive: true, force: true });
});

test('multi-session: cap of 4 disables the + button at the 4th session', async () => {
  const repoDir = initRepo();
  const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-multi-store-'));
  const app = await launchJide({ dialogReturnPath: repoDir, storeCwd, fakeClaudeScript: SCRIPT_A });
  const page = await app.firstWindow();
  await page.evaluate(() => window.jide.projects.add());
  await page.getByTestId('worktree-main').click();
  await page.getByTestId('empty-sessions-cta').click();
  for (let i = 0; i < 3; i++) await page.getByTestId('session-strip-new').click();
  await expect(page.locator('[data-testid^="session-chip-"]')).toHaveCount(4);
  await expect(page.getByTestId('session-strip-new')).toBeDisabled();
  await app.close();
  rmSync(repoDir, { recursive: true, force: true });
  rmSync(storeCwd, { recursive: true, force: true });
});

test('multi-session: persistence — sessions survive a close+relaunch', async () => {
  const repoDir = initRepo();
  const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-multi-store-'));

  // First run: open, create one session, send one prompt, close.
  {
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd, fakeClaudeScript: SCRIPT_A });
    const page = await app.firstWindow();
    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();
    await page.getByTestId('empty-sessions-cta').click();
    await page.getByTestId('composer-input').fill('Persist me');
    await page.getByTestId('composer-input').press('Enter');
    await expect(page.locator('[data-testid^="message-claude-"]').first())
      .toBeVisible({ timeout: 5000 });
    await app.close();
  }

  // Second run: same storeCwd, expect the session to be rehydrated.
  {
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd, fakeClaudeScript: SCRIPT_A });
    const page = await app.firstWindow();
    await page.getByTestId('worktree-main').click();
    await expect(page.locator('[data-testid^="session-chip-"]')).toHaveCount(1);
    await expect(page.locator('[data-testid^="message-claude-"]', { hasText: 'Reply from session A.' }))
      .toBeVisible({ timeout: 3000 });
    await app.close();
  }

  rmSync(repoDir, { recursive: true, force: true });
  rmSync(storeCwd, { recursive: true, force: true });
});
```

> The persistence test depends on the renderer auto-selecting the rehydrated worktree on second launch. If `lastWorktreeId` isn't restored automatically, click the worktree explicitly first (as above). Confirm when implementing.

### Step 13.3: Run

```bash
pnpm test:e2e -- tests/e2e/multi-session.spec.ts
```

Expected: 4 tests passing. If the ⌘T test fails on the CI runner (different platform key binding), guard the test with `test.skip(process.platform !== 'darwin', ...)`.

### Step 13.4: Commit

```bash
git add tests/fixtures/claude-events/multi-session-*.script.json tests/e2e/multi-session.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): multi-session lifecycle — switch, hotkey, cap, persistence

Four E2E scenarios pinned against fake-claude scripts:
1. Create two sessions via the + button, send distinct prompts, switch
   back and forth, verify transcripts are isolated.
2. ⌘T (Meta+t in Playwright) opens a second session and activates it.
3. The + button disables once the cap (4) is reached.
4. A session created in run #1 (same JIDE_TEST_STORE_CWD) is
   rehydrated in run #2 with its prior transcript intact.

All four use the same fake-claude script, varying only the prompt
content. The persistence test is the canary for Option B — if it
breaks, the persist/rehydrate round trip is the place to investigate.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 14: Verify + DoD walk-through

**Files:** none — verification only.

### Step 14.1: Full verify

```bash
pnpm verify
```

Expected: typecheck + lint + format:check + unit + e2e all green.

### Step 14.2: Manual smoke

1. `pnpm dev`, abrir un proyecto con dos worktrees.
2. Crear 3 sesiones en uno; verificar el strip + cap deshabilitando el + al 4º.
3. ⌘T verifica que crea una sesión nueva (la 4ª) y la activa.
4. Cerrar la app con cmd+Q. Reabrir. Verificar que las 4 chips siguen ahí, con sus títulos inferidos.
5. Doble-click a un chip, renombrar, Enter. Reabrir la app. Verificar que el rename persiste.
6. Mata una sesión por su chip ×. Verificar que el strip baja a 3 y el + se vuelve a habilitar.

### Step 14.3: DoD checklist

- [ ] Click en `+` del SessionStrip crea una sesión nueva sin afectar las otras.
- [ ] Tengo 3 sesiones corriendo en paralelo en un worktree — todas streamean independientemente.
- [ ] El status dot del worktree refleja el roll-up de las 3 sesiones (running > awaiting > error > idle).
- [ ] Cerrar la sesión activa selecciona la siguiente automáticamente.
- [ ] Reabrir la app vuelve al worktree y sesión donde lo dejé, con su transcript intacto.
- [ ] ⌘T crea una sesión nueva, ⌘T cuando el cap está alcanzado no hace nada (y el + está deshabilitado).
- [ ] Doble-click sobre un chip permite renombrarlo; el rename persiste al recargar.
- [ ] El `SessionMeta` muestra modelo, status y coste de la sesión activa.
- [ ] `pnpm verify` está verde local y en GH Actions.

---

## Known issues / decisiones diferidas

- **`tokens` y `ctxPct`** — el protocolo CLI de Phase 3 no expone tokens por turno ni context utilization; `SessionMeta` los muestra como `—`. Cuando un follow-up amplíe `SessionSnapshot` con esos campos (probablemente al portar `assistant.usage` del CLI), `SessionMeta` se actualiza sin tocar nada más.
- **Resume del CLI** — Phase 4 spawnea con `--resume <uuid>` al rehidratar. Si el CLI ha purgado la conversación del lado servidor, emite un error que tratamos como cualquier otro `session.error`. No hay UX especial todavía ("intentar resume; si falla, sesión nueva con la misma uuid") — es un follow-up si los usuarios lo piden.
- **Persistencia eager** — sólo escribimos en `before-quit`. Un crash duro pierde la última turn. Un follow-up puede añadir flush cada N turns o un debounce post-message.
- **`activeSessionByWt` y el worktree activo al reabrir** — Phase 4 persiste `activeSessionByWt` pero no `lastWorktreeId` (eso ya existía). Si el usuario cierra mientras está en wt-A pero wt-B tiene sesiones rehidratadas, al reabrir vuelve a wt-A (sin sesiones visibles hasta que cambie de worktree). Aceptable.
- **Cap configurable en UI** — la setting `maxSessionsPerWorktree` está en el schema y se lee al boot, pero no hay UI para cambiarla todavía. Phase 5 (Tweaks panel) lo expone.
- **ApprovalBar multi-sesión** — sigue como en Phase 3: `bypassPermissions`, no-op handler. El plan no cambia esto.
- **Tooltip de "Cap alcanzado"** — el botón + muestra `title="Cap alcanzado"` cuando aplica. Sin diseño dedicado en Phase 4; Phase 5 puede mejorarlo.
- **Title rename con conflicto** — si el usuario renombra a un título igual al de otra sesión, no hay enforcement de unicidad. Permitido en Phase 4 — el uuid es la identidad real.

---

## Hand-off a Fase 5

- `ChatPanel` ya consume `SessionStrip` y `SessionMeta` con estilos inline — Fase 5 mueve esos hex a `ThemeProvider` sin cambiar la API de los componentes.
- `useSessionsList` y `useSession` son hooks estables — Fase 5 los reutiliza tal cual desde el TabBar de worktrees.
- `claudeStateForWorktree` es la fuente de verdad del roll-up. Si Fase 5 añade indicadores adicionales en la StatusBar inferior, lo consume directo.
- `maxSessionsPerWorktree` ya está en `SettingsSchema` — Fase 5 expone el slider en `TweaksPanel`.
- Persistencia: el shape `sessions: Record<wtId, PersistedSession[]>` es estable; cualquier campo nuevo en `SessionSnapshot` se persiste automáticamente sin migración.
