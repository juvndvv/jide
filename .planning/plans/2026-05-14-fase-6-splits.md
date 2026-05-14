# Fase 6 — Splits (terminal + chat) (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada worktree gana dos ejes de split totalmente compuestos:

1. **Terminal split** — un PTY interactivo (shell del usuario, `cwd = worktree.path`) que se enseña en `off | bottom | side` mediante un botón en `StatusBar` y la hotkey `⌘\`. Stream real de stdout, input real, resize correcto, theme sincronizado con `useTheme()`. Sobrevive a cambiar de tab; muere al cerrar la tab definitivamente del worktree o al cerrar la app.
2. **Chat split** — el área de chat pasa de un único panel a un **árbol binario** de hasta 4 hojas. Cada hoja muestra una sesión Claude (o queda vacía como drop-target). El usuario splittea con un botón en la cabecera del panel; alterna la orientación del split contenedor (`v ↔ h`); arrastra chips del `SessionStrip` para asignar sesiones a cada hoja. No hay hotkey en Fase 6 — solo botones (palette llega en Fase 8).

**Architecture:** Tres cambios estructurales en el renderer:

- El layout de `<main>` deja de ser una columna fija (`TabBar / ChatPanel`) y pasa a `TabBar / <WorktreeView />` donde `<WorktreeView />` orquesta el split principal **chat-vs-terminal** y dentro del chat el **árbol de paneles**.
- `<ChatPanel>` se trocea: el contenedor del worktree mantiene `SessionStrip` global y se compone con `<ChatGrid />` (renderizador recursivo del árbol). Las hojas son `<ChatPane />` — cada una se subscribe a UNA sesión vía `useSession(worktreeId, sessionId)`. Composer + ApprovalBar + SessionMeta viven dentro de cada hoja, así puedes escribir simultáneamente en 4 sesiones.
- Estado del layout por worktree (`PaneTree` + `terminal: 'off'|'bottom'|'side'` + ratios) vive en un nuevo hook `useWorktreeLayout(worktreeId)` apoyado en `electron-store` igual que `useTabs` (Fase 5). Persistencia con debounce.

**Main process** añade un módulo `pty/` con `PtyManager` que crea un PTY por `(projectId, worktreePath)` — sí, **uno por worktree, no por tab** (decisión cerrada). Stream se emite por el canal `terminal:data` chunked, igual patrón que `sessions:event` de Fase 3. La detección de shell consulta `$SHELL` con fallback razonable por OS. `before-quit` mata los PTYs.

**Native-build risk:** `node-pty` requiere recompilación contra los headers de Electron 35. Se añade `@electron/rebuild` con script `postinstall` que se ejecuta tras `pnpm install`. Si el rebuild falla, el dev experience se rompe **silenciosamente** (la app arranca pero el PTY no spawnea). La Task 2 incluye un health-check explícito al inicio de `PtyManager`.

**Tech Stack añadido:** `node-pty`, `xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`, `@electron/rebuild`. Total dev-dep peso ~5MB (`node-pty` trae los binarios prebuilt para macOS x64/arm64 + Linux/Win). Sin runtime extra del lado renderer salvo `xterm` (~600KB minified, dynamic-import opcional).

**Tests:**
- Unit (vitest): ops del árbol de paneles (split, merge, assignSession, toggleAxis), shell-detect, parser de `Worktree.id`, settings drift.
- E2E (Playwright): abrir terminal con `⌘\`, ciclar `off→bottom→side→off`, escribir un comando que produce output determinista (`echo hola`) y verificar que el output aparece. Chat: splittear panel activo, arrastrar chip a la hoja vacía, verificar que la nueva hoja se suscribe a la sesión correcta.

**Dependencia crítica:** Task 1 (schema + types) bloquea Tasks 4, 5, 11. Task 2 (PtyManager + IPC + postinstall) bloquea Task 3 (renderer Terminal). Task 5 (`useWorktreeLayout`) bloquea Tasks 6-10. Task 8 (drag-and-drop) toca tanto `SessionChip` como `ChatPane` así que va después de Task 7.

---

## Decisiones cerradas (entrada al plan)

| Pregunta | Respuesta | Implicación |
|---|---|---|
| Cap de hojas chat | **4** (`MAX_CHAT_PANES = 4`, hardcoded en Fase 6 — configurable en futuro si surge demanda). | Validación al splittear: bloqueada cuando `countLeaves(tree) >= 4`. |
| Orientación del split | **Toggle vertical ↔ horizontal** en cada nodo split. Cuando hay >2 hojas, cada `split` tiene su propio `axis`. | El árbol es binario: cada nodo `split` lleva su axis local. UI muestra un botón "swap" en el divisor cuando hover. |
| Asignación de sesión | **Drag desde `SessionStrip`** (HTML5 DnD). Click en chip selecciona/foca pero no reasigna. | `SessionChip` gana `draggable`. `<ChatPane>` es drop-target. Sin librería de DnD — APIs nativas + un poco de visual feedback. |
| Hotkey chat split | **Ninguna en Fase 6.** Botón "+ split" en cabecera de cada `<ChatPane />` (la cabecera ya existe para mostrar el título de sesión + cerrar pane). Toggle de axis = botón en el divisor. | Reduce superficie. Fase 8 (palette) puede mapear acciones. |
| PTY granularidad | **Uno por worktree** (`Map<worktreeId, IPty>`). Persiste entre cambios de tab. Muere cuando se cierra explícitamente, al cerrar el worktree definitivamente, o en `before-quit`. | El usuario no pierde su shell al saltar de worktree. Memoria: N worktrees abiertos × 1 PTY. |
| Shell por defecto | **`$SHELL` del usuario** con fallbacks: macOS/Linux → `/bin/zsh` si existe, else `/bin/bash`; Windows → `pwsh.exe` si existe, else `cmd.exe`. | Sin opción de Ajustes en Fase 6. La detección se hace en `shell-detect.ts` y es testeable. |
| `cwd` del PTY | `worktree.path` al spawnear. **No** se sincroniza con cambios de `cd` del usuario ni con Claude. | Si el usuario teclea `cd ~/`, el PTY queda en ~. Reset = cerrar y reabrir el terminal (`⌘\` dos veces). |
| Tema xterm | **Sincronizado con `useTheme()`**: bg `theme.codeBg`, fg `theme.text`, cursor `accent.value`. Se actualiza vía `xterm.options.theme = …` al cambio. | Hooks `useEffect([theme, accent])` reescriben el theme en vivo. |
| Resize | El renderer envía `terminal:resize` cada vez que el panel cambia tamaño (debounced 100ms). xterm-addon-fit calcula filas/columnas. | El main proceso llama `ipty.resize(cols, rows)`. Sin polling. |
| Pane vacío | Una hoja recién creada (post-split) tiene `sessionId: null`. Se renderiza como un panel "vacío" con drop-target visible y un mensaje "Arrastra una sesión aquí o pulsa +". | Permite tener una sesión sola tras un split sin forzar la creación de una nueva sesión automáticamente. |
| Comportamiento al asignar una sesión a una hoja | **Move semantics**: si la sesión ya está en otra hoja, la hoja de origen se queda vacía (no se duplica la sesión). Una sesión aparece a lo sumo en una hoja a la vez. | El árbol debe ser internamente consistente: `assignSession(tree, paneId, sessionUuid)` vacía otras hojas con esa sesión. |
| ¿Qué pasa al cerrar la sesión activa de un pane? | El pane queda vacío (`sessionId: null`). El usuario decide si reasignar o cerrar el pane. | Sin auto-pick de otra sesión — predecible. |
| ¿Qué pasa al cerrar el último pane no vacío? | Se cierra el pane vacío restante. El árbol queda con una sola hoja vacía hasta que el usuario asigna una sesión o crea una. | Coherente con "un worktree puede tener 0 sesiones visibles". |
| Persistencia del árbol al cerrar app | Se guarda el snapshot del árbol con los `sessionId`s. Al rehidratar, las sesiones que ya no existen se reemplazan por `null`. El árbol mantiene su forma. | Filtrado de huérfanos en hidratación, igual patrón que `useTabs`. |
| Persistencia del estado del terminal | Solo `terminal: 'off' | 'bottom' | 'side'` y `terminalRatio: number` por worktree. **No** se persiste el scrollback. | Simple y suficiente; scrollback persistente queda fuera de scope. |

---

## File structure (final, end-of-phase)

```
jide/
├── electron-builder.yml                   # (futuro Fase 9) — Fase 6 NO lo necesita aún
├── package.json                           # +deps: node-pty, xterm, addons; +script postinstall + @electron/rebuild
├── pnpm-lock.yaml                         # actualizado
├── src/
│   ├── main/
│   │   ├── index.ts                       # +crear PtyManager; before-quit kill all
│   │   ├── pty/
│   │   │   ├── manager.ts                 # NEW: PtyManager class
│   │   │   ├── shell-detect.ts            # NEW: detectShell(): { command: string; args: string[] }
│   │   │   └── health.ts                  # NEW: probeNativeBindings() — verifica que node-pty carga sin tirar
│   │   └── ipc/
│   │       ├── terminal.ts                # NEW: registra terminal:create/write/resize/kill + emite terminal:data
│   │       └── index.ts                   # +registerTerminalHandlers
│   ├── shared/
│   │   ├── layout.ts                      # NEW: PaneTree, WorktreeLayout, helpers (split/merge/assignSession/toggleAxis)
│   │   ├── settings.ts                    # +layoutByWt: Record<string, WorktreeLayout>
│   │   └── ipc.ts                         # +channels terminal:create/write/resize/kill; +event terminal:data
│   ├── preload/
│   │   └── index.ts                       # +window.jide.terminal = { create/write/resize/kill }
│   └── renderer/src/
│       ├── App.tsx                        # plug WorktreeView en lugar de ChatPanel directo
│       ├── shortcuts/
│       │   ├── useWorktreeLayout.ts       # NEW: persistencia + ops sobre PaneTree + terminal split
│       │   ├── useTerminal.ts             # NEW: API renderer-side del PTY (subscribe to data, write, resize, kill)
│       │   └── useGlobalShortcuts.ts      # +onToggleTerminal handler (⌘\)
│       ├── components/
│       │   ├── Worktree/
│       │   │   ├── WorktreeView.tsx       # NEW: orquestador chat+terminal por worktree
│       │   │   └── SplitContainer.tsx     # NEW: divisor + ratio para chat-vs-terminal
│       │   ├── Chat/
│       │   │   ├── ChatPanel.tsx          # CHANGED: ahora solo contiene SessionStrip + ChatGrid (sin lógica de session activa)
│       │   │   ├── ChatGrid.tsx           # NEW: render recursivo de PaneTree
│       │   │   ├── ChatPane.tsx           # NEW: hoja del árbol — body + composer + approval bar + meta para UNA sesión
│       │   │   ├── PaneHeader.tsx         # NEW: cabecera con título, botón split, botón close
│       │   │   ├── PaneDropTarget.tsx     # NEW: visual overlay cuando se arrastra un chip encima
│       │   │   ├── SessionStrip.tsx       # CHANGED: chips marcados draggable
│       │   │   ├── SessionChip.tsx        # CHANGED: draggable=true; transfer del uuid
│       │   │   ├── SessionMeta.tsx        # sin cambios (recibe snapshot)
│       │   │   ├── (resto sin cambios)
│       │   └── Terminal/
│       │       ├── TerminalPanel.tsx      # NEW: contiene xterm + Header + resize handle
│       │       ├── TerminalHeader.tsx     # NEW: "zsh · /path · cerrar · toggle-side"
│       │       └── useXterm.ts            # NEW: monta xterm.js, fit, web-links; suscribe a terminal:data
│       └── styles.css                     # añade `.xterm` overrides si necesario para que case con theme
└── tests/
    ├── fixtures/
    │   └── echo-shell.mjs                 # NEW: shell-fake que escribe lo que recibe (loopback) para tests E2E del terminal sin shell real
    ├── unit/
    │   ├── shared/
    │   │   └── layout.test.ts             # NEW: ops del árbol (split, merge, assignSession, toggleAxis, countLeaves, findLeaf)
    │   ├── main/
    │   │   └── pty/
    │   │       ├── shell-detect.test.ts   # NEW: paths por OS, fallbacks
    │   │       └── manager.test.ts        # NEW: create/kill, double-kill no-op, list activeWorktrees
    │   └── renderer/
    │       └── useWorktreeLayout.test.tsx # NEW: ops + persist + rehydrate + orphan filter
    └── e2e/
        ├── terminal.spec.ts               # NEW: ⌘\ abre terminal, type/output, ciclar orientación
        └── chat-split.spec.ts             # NEW: split, drag chip, assign session, close pane
```

**Responsabilidades clave:**

- `src/shared/layout.ts` — fuente única de la geometría de paneles. Funciones puras: `countLeaves(tree)`, `findLeaf(tree, id)`, `splitLeaf(tree, leafId, axis)`, `mergeLeaf(tree, leafId)`, `assignSession(tree, leafId, sessionId)`, `toggleAxis(tree, splitId)`. Testeable sin DOM ni React.
- `src/main/pty/manager.ts` — single source of truth sobre PTYs. Sin conocer de UI. Emite `'data'` y `'exit'` por EventEmitter; el IPC layer los traduce a `terminal:data` y `terminal:exit`.
- `src/main/pty/shell-detect.ts` — función pura `detectShell(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): { command: string; args: string[] }`. Sin acceso a `fs` ni `os`. Recibe el `env` y la plataforma — inyectables para test.
- `src/renderer/src/shortcuts/useWorktreeLayout.ts` — única fuente de verdad sobre `WorktreeLayout` por worktree. Ops sobre el árbol vía `src/shared/layout.ts`. Persiste con debounce.
- `src/renderer/src/components/Chat/ChatPane.tsx` — hoja. Renderiza chat body, composer, meta y approval bar para UNA sesión. Subscribe via `useSession`. Si `sessionId === null` muestra empty state con drop-target.
- `src/renderer/src/components/Terminal/useXterm.ts` — encapsula el ciclo de vida de xterm.js: mount, fit on resize, write input, render incoming chunks, dispose.

---

## Conventional Commits — recordatorio

Mismo estándar del repo (ver `~/.claude/CLAUDE.md`):

```
type(scope): short description in imperative mood

Optional body explaining the why (English).

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
```

No `Co-Authored-By`. No `Task:` trailer (rama `feat/fase-6-splits` no tiene ID Asana). Scopes sugeridos: `layout`, `pty`, `terminal`, `chat-split`, `ipc`, `settings`.

---

## Task 1: Shared types — `PaneTree`, `WorktreeLayout`, layout ops

**Files:**
- Create: `src/shared/layout.ts`
- Modify: `src/shared/settings.ts`
- Modify: `src/shared/ipc.ts` (channels + events for terminal)
- Create: `tests/unit/shared/layout.test.ts`
- Modify: `tests/unit/shared/settings.test.ts` (additive)

### Step 1.1 — `src/shared/layout.ts`

```ts
import { randomUUID } from 'node:crypto';

export type PaneAxis = 'h' | 'v';
export type TerminalSplit = 'off' | 'bottom' | 'side';

export interface PaneLeaf {
  kind: 'leaf';
  id: string;
  sessionId: string | null;
}

export interface PaneSplit {
  kind: 'split';
  id: string;
  axis: PaneAxis;
  /** Ratio between first and second (0..1, default 0.5). */
  ratio: number;
  first: PaneTree;
  second: PaneTree;
}

export type PaneTree = PaneLeaf | PaneSplit;

export interface WorktreeLayout {
  /** Binary tree of chat panes. Always non-empty (initial state: single empty leaf). */
  panes: PaneTree;
  /** Active leaf — focus target for keyboard / new sessions. */
  activePaneId: string;
  /** Terminal orientation. 'off' hides the panel; 'bottom' = below chat; 'side' = right of chat. */
  terminal: TerminalSplit;
  /** Ratio chat-vs-terminal (0..1). Only relevant when terminal !== 'off'. */
  terminalRatio: number;
}

export const MAX_CHAT_PANES = 4;

export function makeEmptyLayout(): WorktreeLayout {
  const id = newId();
  return {
    panes: { kind: 'leaf', id, sessionId: null },
    activePaneId: id,
    terminal: 'off',
    terminalRatio: 0.6,
  };
}

function newId(): string {
  return randomUUID();
}

export function countLeaves(tree: PaneTree): number {
  if (tree.kind === 'leaf') return 1;
  return countLeaves(tree.first) + countLeaves(tree.second);
}

export function findLeaf(tree: PaneTree, leafId: string): PaneLeaf | null {
  if (tree.kind === 'leaf') return tree.id === leafId ? tree : null;
  return findLeaf(tree.first, leafId) ?? findLeaf(tree.second, leafId);
}

export function findSplit(tree: PaneTree, splitId: string): PaneSplit | null {
  if (tree.kind === 'leaf') return null;
  if (tree.id === splitId) return tree;
  return findSplit(tree.first, splitId) ?? findSplit(tree.second, splitId);
}

/**
 * Replace `leafId` by a split node containing the original leaf as `first`
 * and a new empty leaf as `second`. No-op (returns tree unchanged) if cap reached
 * or leafId not found.
 */
export function splitLeaf(tree: PaneTree, leafId: string, axis: PaneAxis): PaneTree {
  if (countLeaves(tree) >= MAX_CHAT_PANES) return tree;
  const transform = (node: PaneTree): PaneTree => {
    if (node.kind === 'leaf') {
      if (node.id !== leafId) return node;
      const newLeaf: PaneLeaf = { kind: 'leaf', id: newId(), sessionId: null };
      return { kind: 'split', id: newId(), axis, ratio: 0.5, first: node, second: newLeaf };
    }
    return { ...node, first: transform(node.first), second: transform(node.second) };
  };
  return transform(tree);
}

/**
 * Remove `leafId`. The sibling of the removed leaf replaces the parent split node.
 * If `leafId` is the only leaf in the tree, return a fresh empty leaf.
 */
export function mergeLeaf(tree: PaneTree, leafId: string): PaneTree {
  if (tree.kind === 'leaf') {
    return tree.id === leafId ? { kind: 'leaf', id: newId(), sessionId: null } : tree;
  }
  if (tree.first.kind === 'leaf' && tree.first.id === leafId) return tree.second;
  if (tree.second.kind === 'leaf' && tree.second.id === leafId) return tree.first;
  return { ...tree, first: mergeLeaf(tree.first, leafId), second: mergeLeaf(tree.second, leafId) };
}

/**
 * Assigns `sessionId` to `leafId`. If `sessionId` was already in another leaf,
 * that leaf becomes empty. Move semantics — a session is in at most one leaf.
 * If `sessionId` is null, the leaf becomes empty.
 */
export function assignSession(tree: PaneTree, leafId: string, sessionId: string | null): PaneTree {
  const clear = (node: PaneTree): PaneTree => {
    if (node.kind === 'leaf') {
      if (sessionId !== null && node.sessionId === sessionId && node.id !== leafId) {
        return { ...node, sessionId: null };
      }
      return node;
    }
    return { ...node, first: clear(node.first), second: clear(node.second) };
  };
  const cleared = sessionId !== null ? clear(tree) : tree;
  const apply = (node: PaneTree): PaneTree => {
    if (node.kind === 'leaf') return node.id === leafId ? { ...node, sessionId } : node;
    return { ...node, first: apply(node.first), second: apply(node.second) };
  };
  return apply(cleared);
}

export function toggleAxis(tree: PaneTree, splitId: string): PaneTree {
  if (tree.kind === 'leaf') return tree;
  if (tree.id === splitId) {
    const next: PaneAxis = tree.axis === 'h' ? 'v' : 'h';
    return { ...tree, axis: next };
  }
  return { ...tree, first: toggleAxis(tree.first, splitId), second: toggleAxis(tree.second, splitId) };
}

export function setRatio(tree: PaneTree, splitId: string, ratio: number): PaneTree {
  if (tree.kind === 'leaf') return tree;
  const clamped = Math.max(0.1, Math.min(0.9, ratio));
  if (tree.id === splitId) return { ...tree, ratio: clamped };
  return { ...tree, first: setRatio(tree.first, splitId, clamped), second: setRatio(tree.second, splitId, clamped) };
}

/**
 * Drop refs to sessions that no longer exist. Used at hydration time.
 */
export function pruneOrphans(tree: PaneTree, validSessionIds: ReadonlySet<string>): PaneTree {
  if (tree.kind === 'leaf') {
    if (tree.sessionId === null || validSessionIds.has(tree.sessionId)) return tree;
    return { ...tree, sessionId: null };
  }
  return { ...tree, first: pruneOrphans(tree.first, validSessionIds), second: pruneOrphans(tree.second, validSessionIds) };
}

export function flattenLeafIds(tree: PaneTree): string[] {
  if (tree.kind === 'leaf') return [tree.id];
  return [...flattenLeafIds(tree.first), ...flattenLeafIds(tree.second)];
}
```

> **`randomUUID` import:** funciona en main process (Node) y en renderer (vía `crypto.randomUUID()` global en browsers). Para mantener pureza del módulo y máxima portabilidad, exporta `newId` como argumento opcional inyectable en futuras refactors. Por ahora `node:crypto` está disponible en main y `crypto.randomUUID()` está en electron renderer (Chromium) — no es necesario polyfill. **Verificar al implementar** que `node:crypto` no rompe la build del renderer; si rompe, sustituir por una función helper que use `globalThis.crypto.randomUUID()` y caer a un fallback con `Math.random`.

### Step 1.2 — Extend `SettingsSchema`

`src/shared/settings.ts`:

```ts
import type { Project } from './project.js';
import type { PersistedSession } from './session.js';
import type { AccentId, DensityId, SidebarSide, ThemeMode } from './theme.js';
import type { WorktreeLayout } from './layout.js';

export type { ThemeMode };

export interface TabRef {
  worktreeId: string;
  projectId: string;
}

export interface SettingsSchema {
  theme: ThemeMode;
  density: DensityId;
  accent: AccentId;
  sidebarSide: SidebarSide;
  lastWorktreeId: string | null;
  openTabs: TabRef[];
  projects: Project[];
  maxSessionsPerWorktree: number;
  activeSessionByWt: Record<string, string>;
  sessions: Record<string, PersistedSession[]>;
  /** Per-worktree layout snapshot (chat pane tree + terminal split state). */
  layoutByWt: Record<string, WorktreeLayout>;
}

export const DEFAULT_SETTINGS: SettingsSchema = {
  theme: 'auto',
  density: 'comfy',
  accent: 'coral',
  sidebarSide: 'left',
  lastWorktreeId: null,
  openTabs: [],
  projects: [],
  maxSessionsPerWorktree: 4,
  activeSessionByWt: {},
  sessions: {},
  layoutByWt: {},
};

export type SettingsKey = keyof SettingsSchema;
```

### Step 1.3 — IPC channels for terminal

`src/shared/ipc.ts`. Add to `CHANNELS`:

```
'terminal:create',
'terminal:write',
'terminal:resize',
'terminal:kill',
```

`ChannelMap`:

```ts
'terminal:create': { req: { worktreeId: string; cwd: string }; res: { pid: number } };
'terminal:write': { req: { worktreeId: string; data: string }; res: void };
'terminal:resize': { req: { worktreeId: string; cols: number; rows: number }; res: void };
'terminal:kill':   { req: { worktreeId: string }; res: void };
```

Add to `EVENTS`:

```
'terminal:data',
'terminal:exit',
```

`EventMap`:

```ts
'terminal:data': { worktreeId: string; data: string };
'terminal:exit': { worktreeId: string; code: number | null; signal: NodeJS.Signals | null };
```

Extend `JideApi`:

```ts
terminal: {
  create: (worktreeId: string, cwd: string) => Promise<{ pid: number }>;
  write: (worktreeId: string, data: string) => Promise<void>;
  resize: (worktreeId: string, cols: number, rows: number) => Promise<void>;
  kill: (worktreeId: string) => Promise<void>;
};
```

### Step 1.4 — Drift tests

`tests/unit/shared/layout.test.ts` covers:

- `makeEmptyLayout()` returns 1 leaf with null session, `terminal: 'off'`.
- `countLeaves` on 1-deep, 2-deep, 3-deep trees.
- `splitLeaf` increases count by 1 and respects `MAX_CHAT_PANES` (no-op at cap).
- `splitLeaf` with axis `'h'` and `'v'` produces correct shape.
- `mergeLeaf` of middle leaf: sibling replaces parent.
- `mergeLeaf` of root leaf: returns a fresh empty leaf.
- `assignSession` move semantics: same uuid in 2 leaves → first one cleared.
- `assignSession` with `null` clears the target.
- `toggleAxis` flips a split's axis.
- `setRatio` clamps to [0.1, 0.9].
- `pruneOrphans` drops refs to unknown uuids.
- `flattenLeafIds` ordered traversal.

Append to `tests/unit/shared/settings.test.ts`:

```ts
it('default settings include layoutByWt', () => {
  expect(DEFAULT_SETTINGS.layoutByWt).toEqual({});
});
```

### Step 1.5 — Verify

```bash
pnpm vitest run tests/unit/shared/layout.test.ts tests/unit/shared/settings.test.ts tests/unit/shared/ipc.test.ts
pnpm typecheck
```

Commit as `feat(layout): pane tree + worktree layout schema`.

---

## Task 2: Main process — PtyManager, IPC, electron-rebuild

**Files:**
- Modify: `package.json` (deps + postinstall)
- Create: `src/main/pty/shell-detect.ts`
- Create: `src/main/pty/health.ts`
- Create: `src/main/pty/manager.ts`
- Create: `src/main/ipc/terminal.ts`
- Modify: `src/main/ipc/index.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Create: `tests/unit/main/pty/shell-detect.test.ts`
- Create: `tests/unit/main/pty/manager.test.ts`

### Step 2.1 — Dependencies

```bash
pnpm add node-pty@^1
pnpm add -D @electron/rebuild@^3
```

Add to `package.json` scripts:

```json
"postinstall": "electron-rebuild -f -w node-pty"
```

> `-f` forces rebuild, `-w node-pty` limits scope to the package that needs it. Verify with `pnpm install` from a clean state that `node_modules/node-pty/build/Release/pty.node` exists and is built against the right Electron headers (the rebuild logs the target version).

If `node-pty` releases prebuilt-electron binaries for Electron 35 + the current platform/arch and they get picked up by the install, the rebuild may be a no-op — that's fine. The point of the script is robustness.

### Step 2.2 — `shell-detect.ts`

```ts
import { existsSync } from 'node:fs';

export interface ShellSpec {
  command: string;
  args: string[];
}

/**
 * Pure detector. Receives env + platform so tests can inject scenarios.
 */
export function detectShell(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  fsCheck: (p: string) => boolean = existsSync,
): ShellSpec {
  if (platform === 'win32') {
    if (fsCheck('C:\\Program Files\\PowerShell\\7\\pwsh.exe')) {
      return { command: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe', args: [] };
    }
    return { command: 'cmd.exe', args: [] };
  }
  const fromEnv = env.SHELL;
  if (fromEnv && fsCheck(fromEnv)) {
    return { command: fromEnv, args: ['-l'] };
  }
  if (fsCheck('/bin/zsh')) return { command: '/bin/zsh', args: ['-l'] };
  return { command: '/bin/bash', args: ['-l'] };
}
```

`-l` (login shell) ensures the user's PATH, aliases, and prompt are sourced.

### Step 2.3 — `health.ts`

```ts
export interface NativeProbeResult {
  ok: boolean;
  reason?: string;
}

/**
 * Verify that node-pty's native binding loads. Called on app boot before
 * registering terminal handlers; if it fails, the IPC layer responds with
 * a clear error rather than crashing the renderer.
 */
export async function probeNativeBindings(): Promise<NativeProbeResult> {
  try {
    const mod = await import('node-pty');
    if (typeof mod.spawn !== 'function') {
      return { ok: false, reason: 'node-pty loaded but spawn is not a function' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
```

### Step 2.4 — `manager.ts`

```ts
import { EventEmitter } from 'node:events';
import type * as nodePty from 'node-pty';

export interface PtyData {
  worktreeId: string;
  data: string;
}

export interface PtyExit {
  worktreeId: string;
  code: number | null;
  signal: NodeJS.Signals | null;
}

export interface PtyManagerEvents {
  data: (payload: PtyData) => void;
  exit: (payload: PtyExit) => void;
}

interface ActivePty {
  worktreeId: string;
  process: nodePty.IPty;
}

export interface CreatePtyArgs {
  worktreeId: string;
  cwd: string;
  cols: number;
  rows: number;
}

export class PtyManager extends EventEmitter {
  private readonly active = new Map<string, ActivePty>();
  private pty: typeof nodePty | null = null;
  private detector: () => ShellSpec;

  constructor(detector: () => ShellSpec) {
    super();
    this.detector = detector;
  }

  async init(): Promise<void> {
    this.pty = await import('node-pty');
  }

  has(worktreeId: string): boolean {
    return this.active.has(worktreeId);
  }

  async create(args: CreatePtyArgs): Promise<{ pid: number }> {
    if (!this.pty) throw new Error('PtyManager not initialised');
    const existing = this.active.get(args.worktreeId);
    if (existing) return { pid: existing.process.pid };
    const shell = this.detector();
    const proc = this.pty.spawn(shell.command, shell.args, {
      cwd: args.cwd,
      cols: args.cols,
      rows: args.rows,
      env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
      name: 'xterm-256color',
    });
    this.active.set(args.worktreeId, { worktreeId: args.worktreeId, process: proc });
    proc.onData((data) => this.emit('data', { worktreeId: args.worktreeId, data } satisfies PtyData));
    proc.onExit(({ exitCode, signal }) => {
      this.active.delete(args.worktreeId);
      this.emit('exit', { worktreeId: args.worktreeId, code: exitCode, signal: (signal ?? null) as NodeJS.Signals | null });
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

  activeWorktrees(): string[] {
    return [...this.active.keys()];
  }
}

import type { ShellSpec } from './shell-detect.js';
```

> **Type imports:** `import type * as nodePty from 'node-pty'` is fine even before the dynamic `await import('node-pty')` because `import type` is erased.

### Step 2.5 — IPC wiring `src/main/ipc/terminal.ts`

```ts
import { ipcMain } from 'electron';
import type { PtyManager } from '../pty/manager.js';
import { sendEvent } from './events.js';

export function registerTerminalHandlers(manager: PtyManager): void {
  manager.on('data', (payload) => sendEvent('terminal:data', payload));
  manager.on('exit', (payload) => sendEvent('terminal:exit', payload));

  ipcMain.handle('terminal:create', async (_e, req: { worktreeId: string; cwd: string; cols?: number; rows?: number }) => {
    return manager.create({
      worktreeId: req.worktreeId,
      cwd: req.cwd,
      cols: req.cols ?? 80,
      rows: req.rows ?? 24,
    });
  });
  ipcMain.handle('terminal:write', async (_e, req: { worktreeId: string; data: string }) => {
    manager.write(req.worktreeId, req.data);
  });
  ipcMain.handle('terminal:resize', async (_e, req: { worktreeId: string; cols: number; rows: number }) => {
    manager.resize(req.worktreeId, req.cols, req.rows);
  });
  ipcMain.handle('terminal:kill', async (_e, req: { worktreeId: string }) => {
    manager.kill(req.worktreeId);
  });
}
```

Note: `terminal:create` accepts optional `cols`/`rows` even though the typed contract requires `cwd`. Add them to `ChannelMap` if you want strict typing — preferred. Adjust Step 1.3 accordingly: `req: { worktreeId; cwd; cols: number; rows: number }`.

### Step 2.6 — Plug into `src/main/index.ts`

After creating the SessionManager:

```ts
import { PtyManager } from './pty/manager.js';
import { detectShell } from './pty/shell-detect.js';
import { probeNativeBindings } from './pty/health.js';
import { registerTerminalHandlers } from './ipc/terminal.js';

// ... inside app.whenReady():
const probe = await probeNativeBindings();
if (!probe.ok) {
  console.error('[jide] node-pty native bindings failed to load:', probe.reason);
  // Continue without terminal — the renderer will get an error when trying to spawn.
} else {
  const pty = new PtyManager(() => detectShell(process.env, process.platform));
  await pty.init();
  registerTerminalHandlers(pty);
  app.on('before-quit', () => pty.killAll());
}
```

If `probe.ok === false`, the user still gets the app — just no terminal. The IPC layer would respond with an error if invoked. Better: register a stub handler that throws "terminal unavailable" so the renderer error path stays sane.

### Step 2.7 — Preload bridge

`src/preload/index.ts` — extend `window.jide` with:

```ts
terminal: {
  create: (worktreeId: string, cwd: string, cols = 80, rows = 24) =>
    ipcRenderer.invoke('terminal:create', { worktreeId, cwd, cols, rows }),
  write: (worktreeId: string, data: string) =>
    ipcRenderer.invoke('terminal:write', { worktreeId, data }),
  resize: (worktreeId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', { worktreeId, cols, rows }),
  kill: (worktreeId: string) =>
    ipcRenderer.invoke('terminal:kill', { worktreeId }),
},
```

### Step 2.8 — Tests

`tests/unit/main/pty/shell-detect.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { detectShell } from '../../../../src/main/pty/shell-detect.js';

describe('detectShell', () => {
  it('uses $SHELL when present', () => {
    expect(detectShell({ SHELL: '/usr/local/bin/fish' }, 'darwin', () => true))
      .toEqual({ command: '/usr/local/bin/fish', args: ['-l'] });
  });
  it('falls back to /bin/zsh on darwin without $SHELL', () => {
    expect(detectShell({}, 'darwin', (p) => p === '/bin/zsh'))
      .toEqual({ command: '/bin/zsh', args: ['-l'] });
  });
  it('falls back to /bin/bash if /bin/zsh missing', () => {
    expect(detectShell({}, 'linux', () => false))
      .toEqual({ command: '/bin/bash', args: ['-l'] });
  });
  it('uses pwsh on win32 when available', () => {
    expect(detectShell({}, 'win32', (p) => p === 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'))
      .toEqual({ command: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe', args: [] });
  });
  it('falls back to cmd.exe on win32', () => {
    expect(detectShell({}, 'win32', () => false))
      .toEqual({ command: 'cmd.exe', args: [] });
  });
});
```

`tests/unit/main/pty/manager.test.ts` — covers create/has/kill/killAll without a real `node-pty`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Mock node-pty before importing PtyManager to avoid hitting native bindings in unit tests.
const onDataListeners = new Set<(data: string) => void>();
const onExitListeners = new Set<(e: { exitCode: number; signal?: NodeJS.Signals }) => void>();
const procStub = {
  pid: 12345,
  onData: (fn: (d: string) => void) => onDataListeners.add(fn),
  onExit: (fn: (e: { exitCode: number; signal?: NodeJS.Signals }) => void) => onExitListeners.add(fn),
  write: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn(() => {
    for (const fn of onExitListeners) fn({ exitCode: 0 });
  }),
};
vi.mock('node-pty', () => ({ spawn: vi.fn(() => procStub) }));
// ... tests use PtyManager with a stub ShellSpec detector.
```

> If `vi.mock` doesn't get applied because of the dynamic `import('node-pty')` inside `init()`, alternative: inject the `nodePty` module via the constructor (refactor `PtyManager` to accept `{ ptyModule?: typeof nodePty }`). Cleaner for tests.

### Step 2.9 — Verify

```bash
pnpm install                       # triggers postinstall + electron-rebuild
ls node_modules/node-pty/build/Release/pty.node  # must exist
pnpm dev                           # smoke — app boots without crash even before terminal is exercised
pnpm vitest run tests/unit/main/pty
pnpm typecheck
pnpm lint
```

Commit as `feat(pty): manager, shell detection, ipc handlers and native rebuild`.

---

## Task 3: Renderer Terminal — `useXterm` + `TerminalPanel`

**Files:**
- Create: `src/renderer/src/shortcuts/useTerminal.ts`
- Create: `src/renderer/src/components/Terminal/useXterm.ts`
- Create: `src/renderer/src/components/Terminal/TerminalHeader.tsx`
- Create: `src/renderer/src/components/Terminal/TerminalPanel.tsx`
- Modify: `src/renderer/src/styles.css` (xterm container overrides if needed)
- Modify: `package.json` (`xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`)

### Step 3.1 — Dependencies

```bash
pnpm add xterm @xterm/addon-fit @xterm/addon-web-links
```

> `xterm` package (legacy name). The official rename is `@xterm/xterm` — verify which version is current at install time. If `@xterm/xterm` is the canonical package, use that and update imports accordingly.

### Step 3.2 — `useTerminal.ts`

Thin client over the IPC bridge — subscription to `terminal:data` filtered by `worktreeId`.

```ts
import { useCallback, useEffect, useRef } from 'react';

export interface UseTerminal {
  onData: (cb: (chunk: string) => void) => () => void;
  write: (data: string) => Promise<void>;
  resize: (cols: number, rows: number) => Promise<void>;
  ensureCreated: (cwd: string, cols: number, rows: number) => Promise<void>;
  kill: () => Promise<void>;
}

export function useTerminal(worktreeId: string | null): UseTerminal {
  const createdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      // Note: we intentionally do NOT kill on hook unmount — the PTY survives tab switches.
      createdRef.current = null;
    };
  }, [worktreeId]);

  const onData = useCallback((cb: (chunk: string) => void) => {
    return window.jide.on('terminal:data', (payload) => {
      if (worktreeId && payload.worktreeId === worktreeId) cb(payload.data);
    });
  }, [worktreeId]);

  const ensureCreated = useCallback(async (cwd: string, cols: number, rows: number): Promise<void> => {
    if (!worktreeId) return;
    if (createdRef.current === worktreeId) return;
    await window.jide.terminal.create(worktreeId, cwd, cols, rows);
    createdRef.current = worktreeId;
  }, [worktreeId]);

  const write = useCallback(async (data: string): Promise<void> => {
    if (!worktreeId) return;
    await window.jide.terminal.write(worktreeId, data);
  }, [worktreeId]);

  const resize = useCallback(async (cols: number, rows: number): Promise<void> => {
    if (!worktreeId) return;
    await window.jide.terminal.resize(worktreeId, cols, rows);
  }, [worktreeId]);

  const kill = useCallback(async (): Promise<void> => {
    if (!worktreeId) return;
    await window.jide.terminal.kill(worktreeId);
    createdRef.current = null;
  }, [worktreeId]);

  return { onData, write, resize, ensureCreated, kill };
}
```

### Step 3.3 — `useXterm.ts`

```ts
import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import 'xterm/css/xterm.css';
import type { ThemeTokens, AccentTokens } from '../../theme/tokens';

const RESIZE_DEBOUNCE_MS = 100;

export interface UseXtermArgs {
  containerRef: React.RefObject<HTMLDivElement | null>;
  theme: ThemeTokens;
  accent: AccentTokens;
  onUserInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
}

export function useXterm({ containerRef, theme, accent, onUserInput, onResize }: UseXtermArgs): {
  writeChunk: (data: string) => void;
} {
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new Terminal({
      fontFamily: 'Geist Mono, ui-monospace, monospace',
      fontSize: 12.5,
      cursorBlink: true,
      allowProposedApi: true,
      theme: xtermTheme(theme, accent),
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fit.fit();
    onResize(term.cols, term.rows);
    term.onData(onUserInput);

    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer.current ?? undefined);
      resizeTimer.current = window.setTimeout(() => {
        fit.fit();
        onResize(term.cols, term.rows);
      }, RESIZE_DEBOUNCE_MS);
    });
    ro.observe(containerRef.current);

    termRef.current = term;
    fitRef.current = fit;
    return () => {
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // intentionally exhaustive-deps relaxed: theme/accent updated below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update theme in place when tokens change (no remount).
  useEffect(() => {
    if (!termRef.current) return;
    termRef.current.options.theme = xtermTheme(theme, accent);
  }, [theme, accent]);

  const resizeTimer = useRef<number | null>(null);

  const writeChunk = (data: string): void => {
    termRef.current?.write(data);
  };

  return { writeChunk };
}

function xtermTheme(theme: ThemeTokens, accent: AccentTokens): Record<string, string> {
  return {
    background: theme.codeBg,
    foreground: theme.text,
    cursor: accent.value,
    cursorAccent: theme.codeBg,
    selectionBackground: accent.value + '33', // ~20% alpha
    black: theme.text,
    brightBlack: theme.textMed,
    white: theme.text,
    brightWhite: theme.text,
  };
}
```

> The xterm theme object accepts more colors (red/green/yellow/blue/magenta/cyan). For Fase 6 we map them to the semantic tokens of the theme (`error`/`success`/`warning`/`info`) or leave them at xterm defaults. Iterate if shells render uncomfortably.

### Step 3.4 — `TerminalHeader.tsx`

```tsx
import type { JSX } from 'react';
import { JIcon } from '../icons/JIcon';
import { useTheme } from '../../theme/useTheme';

export interface TerminalHeaderProps {
  shellName: string;
  path: string;
  orientation: 'bottom' | 'side';
  onToggleOrientation: () => void;
  onClose: () => void;
}

export function TerminalHeader({ shellName, path, orientation, onToggleOrientation, onClose }: TerminalHeaderProps): JSX.Element {
  const { theme } = useTheme();
  return (
    <div
      data-testid="terminal-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 26,
        padding: '0 10px',
        background: theme.panelMuted,
        borderBottom: `1px solid ${theme.borderHair}`,
        color: theme.textMed,
        fontFamily: 'Geist, ui-monospace, monospace',
        fontSize: 11,
      }}
    >
      <span style={{ color: theme.text, fontWeight: 600 }}>{shellName}</span>
      <span style={{ color: theme.textLow }}>·</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</span>
      <button
        type="button"
        title={orientation === 'bottom' ? 'Mover al lateral' : 'Mover abajo'}
        aria-label="Cambiar orientación del terminal"
        onClick={onToggleOrientation}
        style={{
          border: 0, background: 'transparent', color: theme.textMed,
          cursor: 'pointer', padding: 2, lineHeight: 0,
        }}
      >
        <JIcon name={orientation === 'bottom' ? 'split-v' : 'split-h'} size={12} />
      </button>
      <button
        type="button"
        title="Cerrar terminal (⌘\\)"
        aria-label="Cerrar terminal"
        onClick={onClose}
        style={{
          border: 0, background: 'transparent', color: theme.textMed,
          cursor: 'pointer', padding: 2, lineHeight: 0,
        }}
      >
        <JIcon name="x" size={12} />
      </button>
    </div>
  );
}
```

**Note:** `JIcon` will need icons `split-v` and `split-h` — verify they're already in the set (added in Fase 5 Task 8 — yes, they are). If not, add them in this task with stubs.

### Step 3.5 — `TerminalPanel.tsx`

```tsx
import { useEffect, useRef, type JSX } from 'react';
import { useTheme } from '../../theme/useTheme';
import { useTerminal } from '../../shortcuts/useTerminal';
import { useXterm } from './useXterm';
import { TerminalHeader } from './TerminalHeader';

export interface TerminalPanelProps {
  worktreeId: string;
  cwd: string;
  shellName: string;
  orientation: 'bottom' | 'side';
  onToggleOrientation: () => void;
  onClose: () => void;
}

export function TerminalPanel({ worktreeId, cwd, shellName, orientation, onToggleOrientation, onClose }: TerminalPanelProps): JSX.Element {
  const { theme, accent } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const term = useTerminal(worktreeId);

  // Mount xterm.js into the container.
  const { writeChunk } = useXterm({
    containerRef,
    theme,
    accent,
    onUserInput: (data) => { void term.write(data); },
    onResize: (cols, rows) => { void term.resize(cols, rows); },
  });

  // Ensure PTY exists (idempotent for the same worktree).
  useEffect(() => {
    void term.ensureCreated(cwd, 80, 24);
  }, [term, cwd]);

  // Pipe IPC `terminal:data` for this worktree into xterm.
  useEffect(() => {
    return term.onData(writeChunk);
  }, [term, writeChunk]);

  return (
    <div
      data-testid="terminal-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: theme.codeBg,
      }}
    >
      <TerminalHeader
        shellName={shellName}
        path={cwd}
        orientation={orientation}
        onToggleOrientation={onToggleOrientation}
        onClose={onClose}
      />
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
}
```

### Step 3.6 — `styles.css` overrides

Add (append):

```css
.xterm { padding: 6px 8px; }
.xterm .xterm-screen canvas { display: block; }
```

### Step 3.7 — Verify

```bash
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm build
pnpm dev   # smoke: open the app, eventually the terminal will be wired in Task 4
```

Commit as `feat(terminal): xterm-based renderer panel with ipc wire`.

---

## Task 4: WorktreeView + terminal toggle (`⌘\`)

**Files:**
- Create: `src/renderer/src/components/Worktree/SplitContainer.tsx`
- Create: `src/renderer/src/components/Worktree/WorktreeView.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/shortcuts/useGlobalShortcuts.ts` (add `onToggleTerminal`)
- Modify: `src/renderer/src/components/StatusBar/StatusBar.tsx` (activate Term button)

### Step 4.1 — `SplitContainer.tsx`

Simple two-pane container with orientation prop. Doesn't need a resize handle in Fase 6 — the divider is non-draggable (locked at `ratio`). Iterating to draggable goes later.

```tsx
import type { JSX, ReactNode } from 'react';
import { useTheme } from '../../theme/useTheme';

export interface SplitContainerProps {
  /** 'h' = horizontal divider (rows). 'v' = vertical divider (columns). */
  axis: 'h' | 'v';
  /** Ratio of the first pane (0..1). */
  ratio: number;
  first: ReactNode;
  second: ReactNode;
}

export function SplitContainer({ axis, ratio, first, second }: SplitContainerProps): JSX.Element {
  const { theme } = useTheme();
  const flexDir = axis === 'v' ? 'row' : 'column';
  const dividerSize = '1px';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: flexDir,
        flex: 1,
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <div style={{ flex: ratio, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{first}</div>
      <div
        style={{
          background: theme.borderHair,
          width: axis === 'v' ? dividerSize : '100%',
          height: axis === 'v' ? '100%' : dividerSize,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 - ratio, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{second}</div>
    </div>
  );
}
```

### Step 4.2 — `WorktreeView.tsx`

```tsx
import type { JSX } from 'react';
import type { Worktree } from '@shared/project';
import { ChatPanel } from '../Chat/ChatPanel';
import { TerminalPanel } from '../Terminal/TerminalPanel';
import { SplitContainer } from './SplitContainer';
import { useWorktreeLayout } from '../../shortcuts/useWorktreeLayout';

export interface WorktreeViewProps {
  worktreeId: string | null;
  worktree: Worktree | null;
  shellName: string;
  maxSessionsPerWorktree: number;
}

export function WorktreeView({ worktreeId, worktree, shellName, maxSessionsPerWorktree }: WorktreeViewProps): JSX.Element {
  const { layout, ops } = useWorktreeLayout(worktreeId);
  if (!worktreeId || !worktree) {
    return (
      <ChatPanel worktreeId={worktreeId} maxSessionsPerWorktree={maxSessionsPerWorktree} layout={null} ops={null} />
    );
  }
  const chat = (
    <ChatPanel
      worktreeId={worktreeId}
      maxSessionsPerWorktree={maxSessionsPerWorktree}
      layout={layout}
      ops={ops}
    />
  );
  if (layout.terminal === 'off') return chat;
  const terminal = (
    <TerminalPanel
      worktreeId={worktreeId}
      cwd={worktree.path}
      shellName={shellName}
      orientation={layout.terminal}
      onToggleOrientation={ops.toggleTerminalOrientation}
      onClose={ops.closeTerminal}
    />
  );
  return (
    <SplitContainer
      axis={layout.terminal === 'bottom' ? 'h' : 'v'}
      ratio={layout.terminalRatio}
      first={chat}
      second={terminal}
    />
  );
}
```

> **The `ChatPanel` signature changes**: receives `layout` and `ops` (or `null` when no worktree). The Chat split implementation in Tasks 5-7 will rely on these.

### Step 4.3 — `useGlobalShortcuts` extension

Add `onToggleTerminal` handler — cycle `off → bottom → side → off`. Per-worktree dispatch handled in `App.tsx`.

```ts
export interface GlobalShortcutHandlers {
  onToggleTweaks?: () => void;
  onNewWorktree?: () => void;
  onEscape?: () => void;
  onToggleTerminal?: () => void;  // ⌘\
}
```

In the keydown handler:

```ts
if (mod && e.key === '\\') {
  e.preventDefault();
  handlers.onToggleTerminal?.();
  return;
}
```

### Step 4.4 — Activate Term button in StatusBar

The plan for `StatusBar` (Fase 5) left placeholders for Term/Visor/Comandos. In Fase 6 we add the Term button.

Modify `StatusBar.tsx` (read first):

- Add prop `onToggleTerminal?: () => void` and `terminalSplit?: 'off' | 'bottom' | 'side'`.
- Render the button to the right of the cli path:

```tsx
<button
  type="button"
  aria-label="Terminal (⌘\\)"
  onClick={onToggleTerminal}
  style={{
    height: 22, padding: '0 9px', marginRight: 2,
    borderRadius: 4, border: 0,
    background: terminalSplit !== 'off' ? 'rgba(255,255,255,0.18)' : 'transparent',
    color: '#FFFFFF', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 11.5,
    display: 'inline-flex', alignItems: 'center', gap: 5,
  }}
>
  <JIcon name={terminalSplit === 'bottom' ? 'split-v' : terminalSplit === 'side' ? 'split-h' : 'terminal'} size={11} />
  <span>Term</span>
  <span style={{ opacity: 0.7 }}>⌘\\</span>
</button>
```

> `#FFFFFF` here is the same accepted exception (text on accent background of the StatusBar).

### Step 4.5 — App.tsx wiring

Replace the direct `<ChatPanel ... />` inside `<main>` with `<WorktreeView />`. Add the `onToggleTerminal` handler that calls `ops.cycleTerminal()` on the active worktree's layout.

`ops` is exposed at `WorktreeView`-level via `useWorktreeLayout`. But the global hotkey lives at App level. Pattern: lift the active worktree's `cycleTerminal` callback up via a ref or by computing the layout in `App.tsx` and passing both to `WorktreeView`. The cleanest is to instantiate `useWorktreeLayout(activeWorktreeId)` in `App.tsx` and pass the resulting state + ops down to `WorktreeView` (and `WorktreeView` doesn't call the hook again).

Refactor accordingly: in `App.tsx`:

```tsx
const { layout, ops } = useWorktreeLayout(activeWorktreeId);
// extend handlers with onToggleTerminal: () => ops?.cycleTerminal()
// pass <WorktreeView layout={layout} ops={ops} ... />
```

This avoids the double-mount issue and centralizes the hotkey wiring.

### Step 4.6 — Verify

```bash
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm build
pnpm dev   # ⌘\ should cycle the terminal panel through 3 states
```

Commit as `feat(terminal): toggle ⌘\\ + statusbar button + worktree view shell`.

---

## Task 5: `useWorktreeLayout` — single source of truth for the layout

**Files:**
- Create: `src/renderer/src/shortcuts/useWorktreeLayout.ts`
- Create: `tests/unit/renderer/useWorktreeLayout.test.tsx`

### Step 5.1 — Hook contract

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type PaneTree, type WorktreeLayout, type PaneAxis, type TerminalSplit,
  splitLeaf, mergeLeaf, assignSession, toggleAxis, setRatio,
  makeEmptyLayout, pruneOrphans, countLeaves, findLeaf,
  MAX_CHAT_PANES,
} from '@shared/layout';

const PERSIST_DEBOUNCE_MS = 200;

export interface WorktreeLayoutOps {
  splitActivePane: (axis: PaneAxis) => void;
  mergePane: (leafId: string) => void;
  assignToPane: (leafId: string, sessionId: string | null) => void;
  setActivePane: (leafId: string) => void;
  toggleSplitAxis: (splitId: string) => void;
  setSplitRatio: (splitId: string, ratio: number) => void;
  cycleTerminal: () => void;                  // off → bottom → side → off
  setTerminal: (state: TerminalSplit) => void;
  toggleTerminalOrientation: () => void;       // bottom ↔ side
  closeTerminal: () => void;                   // set to 'off'
}

export interface UseWorktreeLayout {
  layout: WorktreeLayout;
  ops: WorktreeLayoutOps;
  cap: { reached: boolean; count: number; max: number };
}

export function useWorktreeLayout(worktreeId: string | null): UseWorktreeLayout {
  // ... see implementation guidance below
}
```

### Step 5.2 — Implementation guidance

- Internal state: `useState<WorktreeLayout>(makeEmptyLayout())`. When `worktreeId` changes, reload from settings (debounced no-op if same).
- Hydration: on mount or when `worktreeId` switches, read `layoutByWt[worktreeId]` from settings; if missing, use `makeEmptyLayout()`. Prune orphan session refs by fetching `sessions.list(worktreeId)` and passing the resulting set of uuids to `pruneOrphans`.
- Persistence: write the whole `layoutByWt` map back via `settings.set('layoutByWt', { ...existing, [worktreeId]: layout })` with a 200ms debounce.
- Ops use `setState` with the pure functions from `@shared/layout`. After every op, schedule a debounced persist.
- `splitActivePane`: validates cap (`countLeaves(layout.panes) < MAX_CHAT_PANES`), splits the leaf identified by `layout.activePaneId`. The new empty leaf becomes the active one if user wants. Decision: keep activePaneId pointing at the ORIGINAL leaf (so the user doesn't lose context); they explicitly click into the empty pane to focus it.
- `mergePane`: merges, then if `activePaneId` was the merged leaf, picks any remaining leaf (first one via traversal).
- `cycleTerminal`: `'off' → 'bottom' → 'side' → 'off'`.

### Step 5.3 — Tests

`tests/unit/renderer/useWorktreeLayout.test.tsx` covers:
- Initial layout has 1 empty leaf and `terminal: 'off'`.
- `splitActivePane('v')` results in 2 leaves.
- `splitActivePane` at cap is a no-op.
- `cycleTerminal` cycles through 3 states.
- `assignToPane(otherLeaf, 'uuid-1')` moves the session if it was elsewhere.
- Persist debounce: `settings.set` is called once after multiple ops in <200ms.
- Hydration: when `worktreeId` changes, settings are read and orphans are pruned.

Mock `window.jide.settings` per the existing test pattern.

### Step 5.4 — Verify

```bash
pnpm vitest run tests/unit/renderer/useWorktreeLayout.test.tsx
pnpm typecheck
```

Commit as `feat(layout): useWorktreeLayout hook with persistence`.

---

## Task 6: `ChatPane` — single-session leaf

**Files:**
- Create: `src/renderer/src/components/Chat/PaneHeader.tsx`
- Create: `src/renderer/src/components/Chat/PaneDropTarget.tsx`
- Create: `src/renderer/src/components/Chat/ChatPane.tsx`

### Step 6.1 — `PaneHeader.tsx`

Thin header for each leaf:

```tsx
import type { JSX } from 'react';
import { JIcon } from '../icons/JIcon';
import { useTheme } from '../../theme/useTheme';

export interface PaneHeaderProps {
  title: string;
  status?: string;
  canSplit: boolean;
  canClose: boolean;
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
  onClose: () => void;
  isActive: boolean;
  onFocus: () => void;
}

export function PaneHeader({ title, status, canSplit, canClose, onSplitHorizontal, onSplitVertical, onClose, isActive, onFocus }: PaneHeaderProps): JSX.Element {
  const { theme, accent } = useTheme();
  return (
    <div
      onClick={onFocus}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        height: 24, padding: '0 8px',
        background: isActive ? accent.value + '14' : theme.panelMuted,
        borderBottom: `1px solid ${theme.borderHair}`,
        cursor: 'pointer',
        fontFamily: 'Geist, ui-monospace, monospace',
        fontSize: 11,
        color: theme.textMed,
      }}
    >
      <span style={{ color: theme.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{title}</span>
      {status && <span style={{ color: theme.textLow }}>{status}</span>}
      <button type="button" aria-label="Dividir abajo" disabled={!canSplit} onClick={onSplitHorizontal}
              style={iconBtn(theme.textMed, !canSplit)}>
        <JIcon name="split-v" size={11} />
      </button>
      <button type="button" aria-label="Dividir lateral" disabled={!canSplit} onClick={onSplitVertical}
              style={iconBtn(theme.textMed, !canSplit)}>
        <JIcon name="split-h" size={11} />
      </button>
      {canClose && (
        <button type="button" aria-label="Cerrar panel" onClick={onClose} style={iconBtn(theme.textMed, false)}>
          <JIcon name="x" size={11} />
        </button>
      )}
    </div>
  );
}

function iconBtn(color: string, disabled: boolean): React.CSSProperties {
  return {
    border: 0, background: 'transparent', color,
    cursor: disabled ? 'not-allowed' : 'pointer', padding: 2, lineHeight: 0,
    opacity: disabled ? 0.4 : 1,
  };
}
```

### Step 6.2 — `PaneDropTarget.tsx`

```tsx
import type { JSX, ReactNode } from 'react';
import { useState } from 'react';
import { useTheme } from '../../theme/useTheme';

export interface PaneDropTargetProps {
  onDropSession: (sessionId: string) => void;
  children: ReactNode;
}

export const SESSION_DRAG_MIME = 'application/x-jide-session';

export function PaneDropTarget({ onDropSession, children }: PaneDropTargetProps): JSX.Element {
  const { accent } = useTheme();
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(SESSION_DRAG_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        const uuid = e.dataTransfer.getData(SESSION_DRAG_MIME);
        setOver(false);
        if (uuid) onDropSession(uuid);
      }}
      style={{
        position: 'relative', flex: 1, minHeight: 0, minWidth: 0,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {children}
      {over && (
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            border: `2px dashed ${accent.value}`,
            background: accent.value + '14',
          }}
        />
      )}
    </div>
  );
}
```

### Step 6.3 — `ChatPane.tsx`

Per-leaf binding. Resembles current `ChatPanel` body but for one session only.

```tsx
import { useEffect, useRef, type JSX } from 'react';
import type { SessionSnapshot, Message as Msg } from '@shared/session';
import { useTheme } from '../../theme/useTheme';
import { useSession } from '../../shortcuts/useSession';
import { Message } from './Message';
import { Composer } from './Composer';
import { ApprovalBar } from './ApprovalBar';
import { StreamingIndicator } from './StreamingIndicator';
import { SessionMeta } from './SessionMeta';
import { PaneHeader } from './PaneHeader';
import { PaneDropTarget } from './PaneDropTarget';

export interface ChatPaneProps {
  worktreeId: string;
  leafId: string;
  sessionId: string | null;
  isActive: boolean;
  canSplit: boolean;
  canClose: boolean;
  onFocus: () => void;
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
  onClose: () => void;
  onAssignSession: (sessionId: string) => void;
}

export function ChatPane(props: ChatPaneProps): JSX.Element {
  const { worktreeId, sessionId } = props;
  const { theme } = useTheme();
  const { snapshot, send, approveTool, kill } = useSession(worktreeId, sessionId);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [snapshot?.messages.length, snapshot?.status]);

  return (
    <PaneDropTarget onDropSession={props.onAssignSession}>
      <PaneHeader
        title={snapshot?.title ?? 'Sin sesión'}
        status={snapshot?.status}
        canSplit={props.canSplit}
        canClose={props.canClose}
        onSplitHorizontal={props.onSplitHorizontal}
        onSplitVertical={props.onSplitVertical}
        onClose={props.onClose}
        isActive={props.isActive}
        onFocus={props.onFocus}
      />
      {!sessionId || !snapshot ? (
        <div
          data-testid="pane-empty"
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: theme.textLow, fontFamily: 'ui-monospace, monospace', fontSize: 12,
          }}
        >
          Arrastra una sesión aquí
        </div>
      ) : (
        <>
          <SessionMeta snapshot={snapshot} />
          <div
            ref={listRef}
            data-testid="pane-messages"
            style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column' }}
          >
            {snapshot.messages.map((m: Msg) => <Message key={m.id} message={m} />)}
            {isBusy(snapshot.status) && <StreamingIndicator />}
          </div>
          <ApprovalBar
            awaitingToolUseId={snapshot.awaitingToolUseId ?? null}
            toolName={findPendingTool(snapshot.messages, snapshot.awaitingToolUseId)?.name ?? null}
            onApprove={(id) => { approveTool(id, true).catch(console.error); }}
            onReject={(id, reason) => { approveTool(id, false, reason).catch(console.error); }}
          />
          <Composer
            onSubmit={(text) => { send(text).catch(console.error); }}
            disabled={isBusy(snapshot.status)}
          />
        </>
      )}
    </PaneDropTarget>
  );
}

function isBusy(status: string): boolean {
  return status === 'starting' || status === 'requesting' || status === 'streaming';
}

function findPendingTool(messages: Msg[], awaitingId: string | null | undefined) {
  if (!awaitingId) return null;
  for (const m of messages) if (m.type === 'tool' && m.id === awaitingId) return m;
  return null;
}
```

Commit as `feat(chat-split): ChatPane leaf with drop target and header controls`.

---

## Task 7: `ChatGrid` — recursive tree renderer

**Files:**
- Create: `src/renderer/src/components/Chat/ChatGrid.tsx`
- Modify: `src/renderer/src/components/Chat/ChatPanel.tsx` (consume layout + ops)

### Step 7.1 — `ChatGrid.tsx`

```tsx
import type { JSX } from 'react';
import type { PaneTree } from '@shared/layout';
import { ChatPane } from './ChatPane';
import { SplitContainer } from '../Worktree/SplitContainer';
import type { WorktreeLayoutOps } from '../../shortcuts/useWorktreeLayout';

export interface ChatGridProps {
  worktreeId: string;
  tree: PaneTree;
  activeLeafId: string;
  leafCount: number;
  ops: WorktreeLayoutOps;
}

export function ChatGrid({ worktreeId, tree, activeLeafId, leafCount, ops }: ChatGridProps): JSX.Element {
  return renderNode(tree, worktreeId, activeLeafId, leafCount, ops);
}

function renderNode(node: PaneTree, worktreeId: string, activeLeafId: string, leafCount: number, ops: WorktreeLayoutOps): JSX.Element {
  if (node.kind === 'leaf') {
    return (
      <ChatPane
        worktreeId={worktreeId}
        leafId={node.id}
        sessionId={node.sessionId}
        isActive={node.id === activeLeafId}
        canSplit={leafCount < 4}
        canClose={leafCount > 1}
        onFocus={() => ops.setActivePane(node.id)}
        onSplitHorizontal={() => {
          ops.setActivePane(node.id);
          ops.splitActivePane('h');
        }}
        onSplitVertical={() => {
          ops.setActivePane(node.id);
          ops.splitActivePane('v');
        }}
        onClose={() => ops.mergePane(node.id)}
        onAssignSession={(sessionId) => ops.assignToPane(node.id, sessionId)}
      />
    );
  }
  return (
    <SplitContainer
      axis={node.axis}
      ratio={node.ratio}
      first={renderNode(node.first, worktreeId, activeLeafId, leafCount, ops)}
      second={renderNode(node.second, worktreeId, activeLeafId, leafCount, ops)}
    />
  );
}
```

### Step 7.2 — Refactor `ChatPanel.tsx`

```tsx
import type { JSX } from 'react';
import type { WorktreeLayout } from '@shared/layout';
import type { WorktreeLayoutOps } from '../../shortcuts/useWorktreeLayout';
import { SessionStrip } from './SessionStrip';
import { ChatGrid } from './ChatGrid';
import { useSessionsList } from '../../shortcuts/useSessionsList';
import { useSessionHotkey } from './useSessionHotkey';
import { countLeaves } from '@shared/layout';
import { useTheme } from '../../theme/useTheme';

export interface ChatPanelProps {
  worktreeId: string | null;
  maxSessionsPerWorktree: number;
  layout: WorktreeLayout | null;
  ops: WorktreeLayoutOps | null;
}

export function ChatPanel({ worktreeId, maxSessionsPerWorktree, layout, ops }: ChatPanelProps): JSX.Element {
  const { theme } = useTheme();
  const { sessions, activeId, setActive, create, rename, kill, capReached } =
    useSessionsList(worktreeId, maxSessionsPerWorktree);
  useSessionHotkey(worktreeId !== null && !capReached, () => { void create(); });

  if (!worktreeId || !layout || !ops) {
    return (
      <div
        data-testid="chat-panel-empty"
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: theme.textLow, fontFamily: 'ui-monospace, monospace', fontSize: 14,
          background: theme.panelBg,
        }}
      >
        Selecciona un worktree
      </div>
    );
  }

  const leafCount = countLeaves(layout.panes);

  return (
    <div
      data-testid="chat-panel"
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: theme.panelBg, overflow: 'hidden', minHeight: 0,
      }}
    >
      <SessionStrip
        sessions={sessions}
        activeId={activeId}
        capReached={capReached}
        onSelect={(id) => { void setActive(id); }}
        onRename={(id, title) => { void rename(id, title); }}
        onClose={(id) => { void kill(id); }}
        onNew={() => { void create(); }}
      />
      <ChatGrid
        worktreeId={worktreeId}
        tree={layout.panes}
        activeLeafId={layout.activePaneId}
        leafCount={leafCount}
        ops={ops}
      />
    </div>
  );
}
```

The old `ChatBody` helper, `isBusy`, `findPendingTool` and the active-session-only flow disappear from `ChatPanel`; their logic lives in `ChatPane` now. Composer + ApprovalBar + SessionMeta move to `ChatPane`.

### Step 7.3 — Verify

```bash
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm build
pnpm dev   # smoke: app boots, click "split horizontal" in a pane header → 2 panes appear
```

Commit as `refactor(chat-split): ChatPanel hosts grid of leaf panes`.

---

## Task 8: Drag-and-drop session chips

**Files:**
- Modify: `src/renderer/src/components/Chat/SessionChip.tsx`
- (The drop side is already in `PaneDropTarget` from Task 6.)

### Step 8.1 — `SessionChip` draggable

Add `draggable={true}` and `onDragStart`:

```tsx
onDragStart={(e) => {
  e.dataTransfer.setData(SESSION_DRAG_MIME, snapshot.id.uuid);
  e.dataTransfer.effectAllowed = 'move';
}}
draggable
```

Import `SESSION_DRAG_MIME` from `PaneDropTarget`. Also set the chip's `cursor` to `'grab'` (so users see it's draggable). When dragging, the chip body gets `opacity: 0.5` via `onDragStart`/`onDragEnd` state.

### Step 8.2 — Verify

Smoke manually:
- Open 2 chat panes (split active leaf).
- Drag a chip from `SessionStrip` to the empty pane → assignment works.
- Drag the same chip to another pane → original pane becomes empty.

E2E test added in Task 13.

Commit as `feat(chat-split): drag session chips from strip into panes`.

---

## Task 9: Wire `App.tsx` to the new layout + StatusBar Term button

**Files:**
- Modify: `src/renderer/src/App.tsx`

### Step 9.1

- Call `useWorktreeLayout(activeWorktreeId)` at the App level.
- Pass `layout` + `ops` down to `<WorktreeView />` (and `<ChatPanel />` indirectly via WorktreeView).
- Add `onToggleTerminal: () => ops?.cycleTerminal()` to the global shortcuts `handlers` memo.
- Pass `onToggleTerminal` + `terminalSplit` to `<StatusBar />`.

Sketch:

```tsx
const { layout, ops } = useWorktreeLayout(activeWorktreeId);

const handlers = useMemo(() => ({
  // ... existing
  onToggleTerminal: () => ops?.cycleTerminal(),
}), [activeProject, projects, dialogOpenFor, tweaksOpen, ops]);

// ...

<WorktreeView
  worktreeId={activeWorktreeId}
  worktree={activeWt}
  shellName={inferShellName()}   // see below
  maxSessionsPerWorktree={maxSessions}
  layout={layout}
  ops={ops}
/>

<StatusBar
  project={activeProject}
  worktree={activeWt}
  terminalSplit={layout?.terminal ?? 'off'}
  onToggleTerminal={() => ops?.cycleTerminal()}
/>
```

`inferShellName()`: a renderer-side display helper. Hardcode `'zsh'` for now (the real name comes from main and matches `detectShell`'s decision). A follow-up could expose `terminal:create` returning the shell command label. **Acceptable in Fase 6 to hardcode `'zsh'` and revisit in polish.**

### Step 9.2 — Verify

```bash
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm build
pnpm dev  # smoke: open worktree, click Term in status bar, terminal opens; ⌘\ cycles
```

Commit as `feat(app): integrate worktree layout and terminal shortcut`.

---

## Task 10: Sidebar / NewWorktree integration touch-ups

This task is a small polishing pass. The `Sidebar` should remain unchanged. Verify:

- The split-view changes do NOT regress Fase 5's tabs flow.
- The drop target on `ChatPane` doesn't capture clicks that should reach the chat content (e.g. clicking on a message must not be intercepted).
- `ApprovalBar` height keeps the chat scroll usable when panes are short.

If any regression, fix in this task.

### Acceptance smoke
- Open 2 tabs (worktrees).
- Switch between them — each preserves its own layout (terminal state, pane tree).
- Open terminal in tab A, switch to tab B → terminal in A persists in main process (PtyManager keeps it alive).
- Close tab A → PTY persists (we don't kill on tab close in Fase 6 — tab close only removes the row in TabBar; PTY survives in case user reopens). **Open question:** if `closeTab` should also kill the PTY. Decision: **NO** in Fase 6. The PTY only dies on `before-quit`. Killing on tab close requires a confirmation dialog (zombie processes) and is out of scope.

Commit as `chore(splits): post-integration polish` (only if changes were needed; otherwise skip).

---

## Task 11: Cleanup on app quit + safety nets

**Files:**
- Modify: `src/main/index.ts`

### Step 11.1

Ensure on `before-quit`:
- `pty.killAll()` is called.
- `sessions:write-on-quit` from Fase 4 still runs.

```ts
app.on('before-quit', () => {
  if (manager && store) {
    // ... existing session persistence
  }
  if (pty) pty.killAll();
});
```

> Order matters: persist sessions BEFORE killing PTYs (PTY teardown is sync and fast, sessions persist may need to be sync via `electron-store.set`). Verify by reading the existing `before-quit` block.

### Step 11.2 — Verify

```bash
pnpm dev
# Open terminal, type something, then ⌘Q. Confirm no zombie 'zsh' process left:
ps -ef | grep zsh
```

Commit as `chore(pty): kill PTYs on before-quit`.

---

## Task 12: Persistence integration — orphan filtering and rehydrate

This is the cap of `useWorktreeLayout`'s contract. Verify:

- On worktree switch, `useWorktreeLayout(worktreeId)` reads `layoutByWt[worktreeId]` and calls `pruneOrphans(panes, validUuids)` where `validUuids` comes from `sessions.list(worktreeId)`.
- If `activePaneId` is no longer in the tree (shouldn't happen, but defensively), pick the first leaf in `flattenLeafIds(layout.panes)`.
- If `layoutByWt[worktreeId]` is missing, use `makeEmptyLayout()`.

Add a test ensuring orphan filtering works as expected.

### Step 12.1 — Verify

`pnpm vitest run tests/unit/renderer/useWorktreeLayout.test.tsx` covers rehydrate.

Commit as `test(layout): orphan filtering on rehydrate` (only if Task 5 didn't already include this test).

---

## Task 13: E2E tests

**Files:**
- Create: `tests/fixtures/echo-shell.mjs`
- Create: `tests/e2e/terminal.spec.ts`
- Create: `tests/e2e/chat-split.spec.ts`

### Step 13.1 — `echo-shell.mjs`

A simple Node script that mimics a shell for terminal E2E:
- Reads stdin line-by-line.
- For input `echo X`, writes `X\r\n` to stdout.
- For input `exit`, exits cleanly.

Launch via `JIDE_TEST_SHELL=node tests/fixtures/echo-shell.mjs` — but `node-pty` spawns binaries directly, not Node scripts with args... Adjustment: write the fixture as a small shell script wrapper, or extend `PtyManager` to optionally take an `executable` override from `process.env.JIDE_TEST_PTY_BIN`. Decision: **inject via env** — minimal change.

In `PtyManager.create`, if `process.env.JIDE_TEST_PTY_BIN` is set, use that as the command and `[]` as args. This bypass exists only for tests.

### Step 13.2 — `terminal.spec.ts`

```ts
import { test, expect } from '@playwright/test';
import { launchJide } from './helpers/launch';

test('⌘\\ opens the terminal and echoes input', async () => {
  const app = await launchJide({ /* set JIDE_TEST_PTY_BIN to the echo-shell fixture */ });
  const win = await app.firstWindow();
  // Wait until a worktree is selected (depends on existing fixtures)
  // Press ⌘\
  await win.keyboard.press('Meta+Backslash');
  await expect(win.getByTestId('terminal-panel')).toBeVisible();
  // Type 'echo hola\n' into xterm — xterm consumes via onData
  await win.evaluate(() => {
    const node = document.querySelector('[data-testid="terminal-panel"] .xterm-helper-textarea') as HTMLTextAreaElement;
    node.focus();
  });
  await win.keyboard.type('echo hola\n');
  // The fixture writes 'hola\r\n' back. Verify by reading the visible buffer.
  await expect(win.getByTestId('terminal-panel')).toContainText('hola');
  await app.close();
});

test('⌘\\ cycles off → bottom → side → off', async () => {
  // ... similar pattern, asserting orientation via bounding boxes or computed style.
});
```

### Step 13.3 — `chat-split.spec.ts`

```ts
test('split horizontal then drag a session chip into the empty pane', async () => {
  const app = await launchJide({ /* with fake-claude scripted to one session */ });
  const win = await app.firstWindow();
  // ... establish a worktree with 1 session
  // Click the split-h button in the pane header
  await win.getByTestId('pane-header').first().getByLabel('Dividir abajo').click();
  // Two panes appear
  await expect(win.getByTestId('pane-empty')).toBeVisible();
  // Drag the session chip into the empty pane
  const chip = win.getByTestId('session-strip').locator('[draggable]').first();
  const empty = win.getByTestId('pane-empty');
  await chip.dragTo(empty);
  // The empty pane disappears (now bound to the session)
  await expect(win.getByTestId('pane-empty')).toHaveCount(0);
  await app.close();
});
```

Add a smoke for "close pane via X button — sibling takes over".

### Step 13.4 — Verify

```bash
pnpm test:e2e -- tests/e2e/terminal.spec.ts tests/e2e/chat-split.spec.ts
```

If `xterm` rendering is flaky in headless mode, the terminal test may need extra wait. Use `waitForFunction` to poll the canvas buffer rather than a fixed timeout.

Commit as `test(splits): e2e for terminal toggle and chat pane drag-and-drop`.

---

## Task 14: Final audit + drift guards

Identical structure to Fase 5 Task 13.

1. Hex audit:
   ```
   grep -nP "#[0-9A-Fa-f]{3,8}\b" src/renderer/src
   ```
   Allowed residuals: `#FFFFFF` over `accent.value` AND the `--jide-accent` fallback in `styles.css`.

2. Toolchain:
   ```
   pnpm typecheck
   pnpm lint
   pnpm vitest run
   pnpm test:e2e
   pnpm build
   ```

3. DoD checklist (see below).

4. Commit `chore(splits): final pass — cleanup residuals` only if any cleanup was applied.

---

## Definition of Done

### Terminal
- [ ] `⌘\` cicla la orientación del terminal (`off → bottom → side → off`) y se persiste por worktree.
- [ ] El botón "Term" del `StatusBar` también cicla, y queda visualmente destacado cuando el terminal está visible.
- [ ] El PTY arranca en `worktree.path` con la shell del usuario (`$SHELL`).
- [ ] Comandos básicos funcionan: `git status`, `pnpm test`, `vim README.md` (con curses), `ls --color`.
- [ ] Cambiar de tab y volver mantiene el scrollback en memoria.
- [ ] `⌘Q` no deja procesos zombie (`ps -ef | grep $SHELL` post-quit).
- [ ] El tema xterm respeta `useTheme()` — light/dark se aplica al instante.

### Chat split
- [ ] Cada panel tiene su propio Composer / ApprovalBar / SessionMeta y se subscribe a UNA sesión.
- [ ] Botones "Split horizontal" y "Split vertical" en cabecera del panel funcionan, hasta el cap de 4 hojas.
- [ ] Drag de un chip del `SessionStrip` a una hoja vacía asigna la sesión. Drag a una hoja con sesión la reemplaza.
- [ ] Move semantics: una sesión solo aparece en una hoja a la vez.
- [ ] Cerrar un panel (botón X en cabecera) lo une con su hermano y el árbol mantiene forma. Cerrar el último panel deja una hoja vacía nueva.
- [ ] Cerrar y reabrir la app restaura el árbol por worktree, con orfanos (uuids de sesiones eliminadas) limpiados.

### Persistencia
- [ ] `layoutByWt` en settings persiste el árbol + estado del terminal + ratios.
- [ ] Escritura debounced 200ms, sin pérdida en uso normal.

### Toolchain
- [ ] `pnpm typecheck` (3 tsconfigs) — clean.
- [ ] `pnpm lint` — clean.
- [ ] `pnpm vitest run` — verde (al menos +20 tests nuevos: layout ops, shell-detect, useWorktreeLayout).
- [ ] `pnpm test:e2e` — verde (+2 specs nuevos: terminal, chat-split).
- [ ] `pnpm build` — clean.
- [ ] `pnpm install` clean from scratch deja `node_modules/node-pty/build/Release/pty.node` compilado.

### Hex audit
- [ ] Solo residuales son `#FFFFFF` sobre `accent.value` + `--jide-accent` fallback en `styles.css`.

---

## Riesgos abiertos

- **`node-pty` + Electron 35 + Apple Silicon:** verificar que `electron-rebuild` produce binarios x64+arm64 universales o que el build correcto se elige al runtime. Si falla, plan B: `xterm-headless` + un mock para tests y advertencia en la UI.
- **xterm.js bundle weight:** ~600KB minified. Si Fase 9 (packaging) muestra que el bundle crece demasiado, considerar dynamic-import del módulo Terminal/.
- **Drag-and-drop con xterm focused:** xterm captura agresivamente eventos de teclado. Verificar que el chip-drag entra correctamente al panel xterm (probablemente sí, los `drop` eventos no son afectados, pero documentar si hay caso límite).
- **Composición split chat + terminal en paneles estrechos:** con 4 hojas chat + terminal lateral, las hojas pueden volverse inusables. Decisión Fase 6: confiar en el usuario; añadir min-width sólo si Playwright se queja.
- **`xterm` vs `@xterm/xterm`:** verificar el nombre actual del paquete al instalar — el rename ocurrió en 2024. Si `@xterm/xterm` es el canónico, usar ese; ajustar imports.
- **Sincronización de scroll en multi-panel:** ninguna por ahora. Cada pane tiene su scroll independiente.
- **Persistencia del shell:** si el usuario cambia su `$SHELL` entre sesiones, el siguiente arranque del worktree usará el nuevo. Comportamiento esperado.

---

## Hand-off a Fase 7 (file viewer + watcher)

- El layout `WorktreeView` ya soporta `SplitContainer`. Fase 7 puede añadir un tercer split (visor de archivos a la izquierda o derecha del chat) reusando `SplitContainer` y un nuevo eje en `WorktreeLayout`.
- El patrón `useXterm` con `ResizeObserver` y debounce 100ms es el mismo que necesitará el editor de Monaco / shiki en Fase 7 si entra como surface adicional.
- `useWorktreeLayout` ya gestiona persistencia con debounce — Fase 7 añade `viewer: { open: boolean; path: string | null }` al schema sin tocar el core.
