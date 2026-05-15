# Fase 7 — File viewer read-only + watcher (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada worktree gana un **visor de archivos read-only** como tercer eje del split layout, con tres responsabilidades:

1. **Árbol del worktree** — `FileTree` jerárquico construido desde el filesystem del path del worktree. Lazy-expand por directorio (solo abre nodos al hacer click). Anotaciones de git status (`M / A / D / ??`) por nodo. Virtualizado con `react-window` si la lista visible supera 500 nodos.
2. **Visor de contenido** — `FileContent` renderiza el archivo seleccionado con syntax highlight via `shiki` (themes `github-light` / `github-dark`, sincronizados con `useTheme()`). Read-only (`<pre>` + HTML estático). Placeholder para binarios. Mensaje claro para archivos `>1MB`.
3. **Watcher en vivo** — `FileWatcher` per-worktree con `chokidar`, debounce 200ms, emite `files:change` con `{ kind, relPath }`. El árbol y el contenido visible se refrescan automáticamente. Git status también se reevalúa.

El visor se abre/cierra con `⌘O` (hotkey global) y desde clicks en `ToolMessage` del chat (cuando Claude hace `edit_file: foo.ts`, click en la cabecera del tool abre `foo.ts` en el visor).

**Architecture:** Dos cambios estructurales en el renderer y un módulo nuevo en main:

- **`WorktreeLayout` gana `viewer: { open: boolean; path: string | null; ratio: number }`** (en `src/shared/layout.ts`). El visor se persiste por worktree igual que el resto del layout — abrir el visor en wt-A no lo abre en wt-B.
- **`<WorktreeView />` orquesta ahora tres ejes**: izquierda el visor (cuando `viewer.open === true`), centro/derecha el chat, abajo (o lateral derecho) el terminal. Internamente se compone con `<SplitContainer>` anidados: si viewer está abierto, layout es `<Split axis=v>{Viewer}{<Split axis=h>{Chat}{Terminal}</Split>}</Split>` (o variantes según orientación del terminal).
- **Main añade `src/main/files/`** con `tree.ts` (`buildTree(path)`), `reader.ts` (`readFile(path, opts)`), `git-status.ts` (`statusMap(repoRoot)`), `watcher.ts` (`createFileWatcher(...)`). Coordinados por `src/main/ipc/files.ts`. **Independiente** del watcher de Fase 2 (que sigue intacto refrescando `worktrees:status-changed`).

**Tech Stack añadido:** `shiki` (~3.5MB con `oniguruma-to-es` y los grammars que registramos — lazy-loaded en el renderer, no entra al chunk inicial) y `react-window` (~7KB minified para virtualizar `FileTree`). `chokidar` ya está en deps de Fase 2 — solo reutilizamos. **NO** añadimos la lib `ignore` (decisión: solo lista fija).

**Tests:**
- **Unit (vitest):** `tree.ts` (filtro ignore, sorting), `reader.ts` (size cap, binary detection), `git-status.ts` (parser `--porcelain v1`), `watcher.ts` (debounce, eventos), reducer del visor sobre `WorktreeLayout`.
- **E2E (Playwright):** abrir visor con `⌘O`, navegar al árbol, click en archivo → ver contenido, modificar archivo externamente (a través de `fs/promises` desde el test) y verificar que el árbol/contenido refrescan. Click en `ToolMessage` con `file_path` abre el visor en ese archivo.

**Dependencia crítica entre tasks:** Task 1 (shared types + IPC + extender `WorktreeLayout` con `viewer`) bloquea TODAS las demás. Tasks 2-5 (main: `tree`, `reader`, `git-status`, `watcher`) son **paralelas entre sí** una vez Task 1 está listo. Task 6 (IPC handlers + preload + event router) consume Tasks 2-5. Tasks 7-10 (renderer) consumen Task 6. Task 11 (WorktreeView refactor) consume Task 10. Task 12 (hotkey + tool message integration) consume Task 11. Task 13 (E2E + audit) cierra.

---

## Decisiones cerradas (entrada al plan)

| Pregunta | Respuesta | Implicación |
|---|---|---|
| Ubicación del visor en el layout | **Tercer eje en `WorktreeLayout`** — `viewer: { open: boolean; path: string \| null; ratio: number }`. Persiste por worktree. | Mismo patrón que `terminal` — toggle global pero estado por worktree. `WorktreeView` se refactoriza para componer 3 ejes. |
| Syntax highlighter | **shiki** con themes `github-light` y `github-dark`, sincronizados con `useTheme()`. Carga dinámica (`await import('shiki')`) en el primer render del `FileContent`. | `useShiki` cachea el highlighter por theme. Suspense fallback es un `<pre>` plano con el contenido. |
| Estrategia del watcher | **Nuevo watcher dedicado per-worktree** (`src/main/files/watcher.ts`). Independiente del watcher per-project de Fase 2. | Dos instancias `chokidar` por worktree activo en el caso peor (Fase 2 + Fase 7). Aceptable para repos < 10k archivos; los ignores hardcoded previenen escalada en monorepos. |
| Gitignore handling | **Solo lista fija**, sin parsear `.gitignore`. Lista: `.git`, `node_modules`, `dist`, `out`, `.vite`, `.next`, `coverage`, `.turbo`, `target`, `build`, `.DS_Store`. | Cero deps de parsing, mismo predicado en `tree.ts` y `watcher.ts`. Archivos como `.env` y logs aparecerán en el árbol — el usuario los ve igual que `ls` los muestra. |
| Tamaño máximo de archivo | **1MB hardcoded** (`MAX_FILE_BYTES = 1024 * 1024`). Archivos mayores muestran un mensaje "Archivo demasiado grande (X KB) — vista deshabilitada". | El stat se hace antes de leer el archivo. Sin streaming parcial. |
| Detección de binarios | **Heurística doble:** (a) detectar bytes nulos (`0x00`) en los primeros 8KB; (b) extensiones conocidas binarias (`png/jpg/jpeg/gif/webp/avif/ico/pdf/zip/tar/gz/exe/dylib/so/wasm/mp4/mov/...`). Si ambas dicen "texto" → text. Si cualquiera dice "binary" → binary. | `BinaryFilePlaceholder` con icono y nombre. Sin preview de imágenes (queda para futuro). |
| Construcción del árbol | **Lazy por directorio** — `files:tree` con un `path` opcional. Sin `path` devuelve el primer nivel; con `path` devuelve los hijos directos de ese path. El renderer expande on-demand. | Evita escanear monorepos enteros al arrancar. Cada `readdir` filtra por lista fija ANTES de devolver. |
| Anotaciones git status | **Derivadas de `git status --porcelain=v1 -z`** ejecutado on-demand: una vez al abrir el visor + en cada `files:change` (debounced 300ms). Cachea `Map<relPath, status>`. | Sin polling. Compatible con la `GitClient` de Fase 2. El parser es un módulo nuevo (`git-status.ts`) — Fase 2 no exponía el detalle por archivo, solo `ahead/behind/changes`. |
| Virtualización del árbol | **`react-window`** activado cuando la lista plana visible (flatten de nodos expandidos) supera **500 nodos**. Por debajo, render directo (más simple y permite animación CSS sin recálculos). | Hook `useFlatTree(tree)` devuelve `{ rows, total }`. `FileTree` cambia render strategy según `rows.length`. |
| Toggle del visor | **`⌘O`** global. Sin atajo distinto para `view current chat tool target`; el click en `ToolMessage` es directo. | Añadir a `useGlobalShortcuts` el handler `onToggleViewer`. |
| Click desde `ToolMessage` | Cuando el `ToolMessage` tiene `input.file_path` o `input.path` (ya detectado en `formatInput` actual), la cabecera del tool se hace **clickable**: dispara `ops.openViewer(relPath)`. Si el visor está cerrado, lo abre. Si está abierto, navega. | La ruta del tool puede ser absoluta o relativa; en main al servirla por IPC se normaliza a relPath del worktree. Si está fuera del worktree, el handler IPC devuelve `null` y el renderer muestra toast/error. |
| Estado vacío del visor | Si `viewer.path === null` y `viewer.open === true`: panel muestra solo el `FileTree` con un placeholder en el área de contenido ("Selecciona un archivo del árbol o usa ⌘O para cerrar"). | El visor abierto siempre muestra árbol — el contenido es lo opcional. |
| Persistencia de scroll del árbol | **No persiste.** Cada vez que el worktree se reabre, el árbol arranca colapsado (solo raíz). | Simpler. Si surge demanda → futuro. |
| Persistencia de `viewer.path` | **Sí persiste.** Al reabrir el worktree, si el archivo todavía existe se reabre; si no existe, `viewer.path = null` y se muestra placeholder. | Validación en hidratación: stat antes de renderizar. |
| Edición desde el visor | **Prohibido.** Render con `<pre>`, sin `contenteditable`, sin selección sospechosa. Solo lectura. | Si en futuro queremos edit-in-place llega vía Fase 9+. |
| Diff vs HEAD para archivos modificados | **No en v1.** El badge `M` señala que el archivo está modificado, pero se renderiza el contenido current sin diff. | Roadmap explícito. Futuro: toggle "show diff". |

---

## File structure (final, end-of-phase)

```
jide/
├── package.json                              # +deps: shiki, react-window; +types/react-window
├── pnpm-lock.yaml                            # actualizado
├── src/
│   ├── main/
│   │   ├── index.ts                          # +crear FileWatcherManager; before-quit dispose all
│   │   ├── files/
│   │   │   ├── tree.ts                       # NEW: readChildren(path) → FileNode[] con ignore fija + sort
│   │   │   ├── reader.ts                     # NEW: readFile(path) → { kind: 'text'|'binary'|'too-large', ... }
│   │   │   ├── git-status.ts                 # NEW: parser git status --porcelain=v1 -z → Map<relPath, GitFileStatus>
│   │   │   ├── watcher.ts                    # NEW: createFileWatcher({ worktreeId, path, onEvent })
│   │   │   └── ignore.ts                     # NEW: isIgnoredPath(relPath) — predicate compartido tree+watcher
│   │   └── ipc/
│   │       ├── files.ts                      # NEW: registra files:tree, files:read, files:open-in-viewer + emite files:change, files:status-changed
│   │       └── index.ts                      # +registerFilesHandlers, +FileWatcherManager wiring
│   ├── shared/
│   │   ├── files.ts                          # NEW: FileNode, FileKind, GitFileStatus, FileReadResult, FileChangeEvent
│   │   ├── layout.ts                         # +ViewerState; extend WorktreeLayout con viewer
│   │   └── ipc.ts                            # +channels files:*, +events files:change y files:status-changed
│   ├── preload/
│   │   └── index.ts                          # +window.jide.files = { tree, read, openInViewer }
│   └── renderer/src/
│       ├── App.tsx                           # +onToggleViewer wired a ops.toggleViewer
│       ├── shortcuts/
│       │   ├── useGlobalShortcuts.ts         # +onToggleViewer (⌘O)
│       │   ├── useWorktreeLayout.ts          # +toggleViewer, +openViewer(path), +closeViewer, +setViewerRatio
│       │   ├── useFileTree.ts                # NEW: estado del árbol expandido + fetch children por path + suscripción a files:change
│       │   └── useFileContent.ts             # NEW: lee contenido del path activo + auto-refresh on files:change matching
│       └── components/
│           ├── Worktree/
│           │   └── WorktreeView.tsx          # CHANGED: 3-eje layout (viewer + chat + terminal)
│           ├── FileViewer/
│           │   ├── FileViewerPanel.tsx       # NEW: cabecera + split horizontal interno (tree | content)
│           │   ├── FileTree.tsx              # NEW: lista plana virtualizada (si >500 nodos) o render directo
│           │   ├── FileTreeNode.tsx          # NEW: una fila — icono dir/file + nombre + badge git
│           │   ├── FileBadge.tsx             # NEW: M/A/D/?? con color del theme
│           │   ├── FileContent.tsx           # NEW: shiki dinámico + ScrollBox
│           │   ├── BinaryFilePlaceholder.tsx # NEW: icono + nombre + tamaño
│           │   ├── TooLargePlaceholder.tsx   # NEW: "archivo demasiado grande"
│           │   ├── EmptyViewer.tsx           # NEW: placeholder cuando viewer.open && !viewer.path
│           │   └── useShiki.ts               # NEW: lazy import('shiki') + caché de highlighter por theme
│           ├── Chat/
│           │   └── ToolMessage.tsx           # CHANGED: input.file_path / input.path clickable
│           └── icons/
│               └── (añadir 'file', 'folder', 'folder-open', 'binary' al set)
└── tests/
    ├── fixtures/
    │   └── viewer-repo/                      # repo tmp construido en setup para tests de tree/watcher
    ├── unit/
    │   ├── shared/
    │   │   └── layout-viewer.test.ts         # NEW: ops viewer sobre WorktreeLayout (open, close, setPath, setRatio)
    │   ├── main/
    │   │   └── files/
    │   │       ├── tree.test.ts              # NEW: ignore list, hidden files, sort dirs first
    │   │       ├── reader.test.ts            # NEW: text/binary/too-large/missing
    │   │       ├── git-status.test.ts        # NEW: parser de --porcelain v1 -z con entradas combinadas
    │   │       └── watcher.test.ts           # NEW: debounce, eventos, dispose
    │   └── renderer/
    │       └── useFileTree.test.tsx          # NEW: expand/collapse + flatten + ordenación
    └── e2e/
        └── file-viewer.spec.ts               # NEW: ⌘O abre, click archivo, edición externa refresca, click ToolMessage abre archivo
```

**Responsabilidades clave:**

- `src/shared/files.ts` — fuente única de tipos del visor: `FileNode`, `FileKind`, `GitFileStatus`, `FileReadResult`, `FileChangeEvent`.
- `src/main/files/tree.ts` — función pura `readChildren(absPath: string, repoRoot: string)` → `Promise<FileNode[]>`. Filtra por `isIgnoredPath`. Ordena: dirs primero, alfabético dentro de cada grupo.
- `src/main/files/reader.ts` — `readFile(absPath: string): Promise<FileReadResult>`. Stat → decide `text | binary | too-large`. Sin streaming.
- `src/main/files/git-status.ts` — `loadStatus(repoRoot: string): Promise<Map<string, GitFileStatus>>`. Ejecuta `git status --porcelain=v1 -z` via `simple-git` / `execa` ya disponible (Fase 2 usa `execa`).
- `src/main/files/watcher.ts` — `createFileWatcher({ worktreeId, path, onEvent })` → handle con `.dispose()`. Debounce 200ms, agrupa eventos por path final.
- `src/main/files/ignore.ts` — `isIgnoredPath(relPath: string): boolean`. Mismo predicado consumido por tree y watcher para que ambos vean el mismo universo.
- `src/main/ipc/files.ts` — orquestador: `FileWatcherManager` (mantiene `Map<worktreeId, WatcherHandle>`), handlers `files:tree`/`files:read`/`files:open-in-viewer`, eventos `files:change` y `files:status-changed`.
- `src/renderer/src/shortcuts/useFileTree.ts` — estado local del árbol expandido (`Set<string>` de paths expandidos), cache de children por path, suscripción a `files:change` que invalida el cache afectado.
- `src/renderer/src/shortcuts/useFileContent.ts` — para el `viewer.path` activo, lee el archivo y se resuscribe a `files:change` con match exacto del path.
- `src/renderer/src/components/FileViewer/useShiki.ts` — encapsula la carga dinámica de `shiki`. Devuelve `{ highlighter, ready }`. Único punto de import dinámico, evita que el bundle inicial cargue el WASM.

---

## Conventional Commits — recordatorio

Mismo estándar del repo (ver `~/.claude/CLAUDE.md`):

```
type(scope): short description in imperative mood

Optional body explaining the why (English).

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
```

No `Co-Authored-By`. No `Task:` trailer (rama `feat/fase-7-file-viewer` no tiene ID Asana). Scopes sugeridos: `layout`, `files`, `viewer`, `ipc`, `watcher`, `shortcuts`, `chat`.

Rama de la fase: `feat/fase-7-file-viewer` desde `main`.

---

## Task 1: Shared types + IPC + extender `WorktreeLayout` con `viewer`

**Files:**
- Create: `src/shared/files.ts`
- Modify: `src/shared/layout.ts`
- Modify: `src/shared/ipc.ts`
- Modify: `src/preload/index.ts`
- Create: `tests/unit/shared/layout-viewer.test.ts`

### Step 1.1 — `src/shared/files.ts`

```ts
export type FileKind = 'file' | 'dir';

export interface FileNode {
  name: string;
  /** Path relative to the worktree root. Uses POSIX separators ('/') even on Windows. */
  relPath: string;
  kind: FileKind;
  /** Only for files. Set during readChildren via stat. */
  sizeBytes: number | null;
}

export type GitFileStatus = 'M' | 'A' | 'D' | 'R' | 'C' | 'U' | '??' | null;

export type FileReadResult =
  | { kind: 'text'; content: string; lang: string | null; sizeBytes: number }
  | { kind: 'binary'; sizeBytes: number; ext: string }
  | { kind: 'too-large'; sizeBytes: number }
  | { kind: 'missing' };

export type FileChangeKind = 'add' | 'change' | 'unlink' | 'add-dir' | 'unlink-dir';

export interface FileChangeEvent {
  worktreeId: string;
  /** Relative to the worktree root. POSIX separators. */
  relPath: string;
  kind: FileChangeKind;
}

export interface FileStatusChangeEvent {
  worktreeId: string;
  /** Sparse map — only entries that changed since last emission. */
  changes: Record<string, GitFileStatus>;
}

export const MAX_FILE_BYTES = 1024 * 1024;
```

### Step 1.2 — Extender `WorktreeLayout` en `src/shared/layout.ts`

Añadir el tipo `ViewerState` y campo `viewer` al final del interface `WorktreeLayout`. Helpers nuevos: `openViewer`, `closeViewer`, `toggleViewer`, `setViewerPath`, `setViewerRatio`.

```ts
export interface ViewerState {
  /** Whether the viewer panel is open in this worktree. */
  open: boolean;
  /** Active file (POSIX relPath). null = tree visible, content area shows EmptyViewer. */
  path: string | null;
  /** Ratio of viewer column vs the rest (0..1). Default 0.28. */
  ratio: number;
}

export interface WorktreeLayout {
  panes: PaneTree;
  activePaneId: string;
  terminal: TerminalSplit;
  terminalRatio: number;
  /** Per-worktree viewer state. Default: { open: false, path: null, ratio: 0.28 }. */
  viewer: ViewerState;
}

export function makeEmptyLayout(): WorktreeLayout {
  const id = newId();
  return {
    panes: { kind: 'leaf', id, sessionId: null },
    activePaneId: id,
    terminal: 'off',
    terminalRatio: 0.6,
    viewer: { open: false, path: null, ratio: 0.28 },
  };
}

export function openViewer(layout: WorktreeLayout, path: string | null): WorktreeLayout {
  return { ...layout, viewer: { ...layout.viewer, open: true, path } };
}

export function closeViewer(layout: WorktreeLayout): WorktreeLayout {
  if (!layout.viewer.open) return layout;
  return { ...layout, viewer: { ...layout.viewer, open: false } };
}

export function toggleViewer(layout: WorktreeLayout): WorktreeLayout {
  return layout.viewer.open ? closeViewer(layout) : openViewer(layout, layout.viewer.path);
}

export function setViewerPath(layout: WorktreeLayout, path: string | null): WorktreeLayout {
  return { ...layout, viewer: { ...layout.viewer, path } };
}

export function setViewerRatio(layout: WorktreeLayout, ratio: number): WorktreeLayout {
  const clamped = Math.min(0.6, Math.max(0.15, ratio));
  if (layout.viewer.ratio === clamped) return layout;
  return { ...layout, viewer: { ...layout.viewer, ratio: clamped } };
}
```

**Migración:** `layoutByWt` en settings ya está poblado por Fase 6. Cuando `useWorktreeLayout` hidrata, los layouts viejos **NO** tienen `viewer`. Solución: tras leer `stored`, hacer `{ ...stored, viewer: stored.viewer ?? { open: false, path: null, ratio: 0.28 } }`. Esto se aplica en Task 7.

### Step 1.3 — IPC channels y eventos

`src/shared/ipc.ts`. Añadir a `CHANNELS`:

```
'files:tree',
'files:read',
'files:open-in-viewer',
```

`ChannelMap`:

```ts
'files:tree': {
  req: { worktreeId: string; relPath: string | null };
  res: FileNode[];
};
'files:read': {
  req: { worktreeId: string; relPath: string };
  res: FileReadResult;
};
/** Translates a tool message path (may be absolute) to a worktree-relative path, or null if outside. */
'files:open-in-viewer': {
  req: { worktreeId: string; pathFromTool: string };
  res: { relPath: string } | null;
};
```

Añadir a `EVENTS`: `'files:change'`, `'files:status-changed'`.

`EventMap`:
```ts
'files:change': FileChangeEvent;
'files:status-changed': FileStatusChangeEvent;
```

Añadir a `JideApi`:
```ts
files: {
  tree: (worktreeId: string, relPath: string | null) => Promise<FileNode[]>;
  read: (worktreeId: string, relPath: string) => Promise<FileReadResult>;
  openInViewer: (
    worktreeId: string,
    pathFromTool: string,
  ) => Promise<{ relPath: string } | null>;
};
```

### Step 1.4 — Preload exposure

`src/preload/index.ts`: añadir el bloque `files: { tree, read, openInViewer }` envolviendo `ipcRenderer.invoke('files:tree' | 'files:read' | 'files:open-in-viewer', …)`. Misma forma que `terminal` de Fase 6.

### Step 1.5 — Tests (TDD)

`tests/unit/shared/layout-viewer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  closeViewer,
  makeEmptyLayout,
  openViewer,
  setViewerPath,
  setViewerRatio,
  toggleViewer,
} from '../../../src/shared/layout';

describe('viewer state ops', () => {
  it('makeEmptyLayout starts viewer closed with default ratio', () => {
    const l = makeEmptyLayout();
    expect(l.viewer).toEqual({ open: false, path: null, ratio: 0.28 });
  });

  it('openViewer with null preserves null path', () => {
    const next = openViewer(makeEmptyLayout(), null);
    expect(next.viewer).toEqual({ open: true, path: null, ratio: 0.28 });
  });

  it('openViewer with path sets path and opens', () => {
    const next = openViewer(makeEmptyLayout(), 'src/foo.ts');
    expect(next.viewer.open).toBe(true);
    expect(next.viewer.path).toBe('src/foo.ts');
  });

  it('toggleViewer flips open and preserves path', () => {
    const a = openViewer(makeEmptyLayout(), 'a.ts');
    const b = toggleViewer(a);
    expect(b.viewer.open).toBe(false);
    expect(b.viewer.path).toBe('a.ts');
    const c = toggleViewer(b);
    expect(c.viewer.open).toBe(true);
    expect(c.viewer.path).toBe('a.ts');
  });

  it('closeViewer is a no-op when already closed', () => {
    const l = makeEmptyLayout();
    expect(closeViewer(l)).toBe(l);
  });

  it('setViewerRatio clamps to [0.15, 0.6]', () => {
    const l = makeEmptyLayout();
    expect(setViewerRatio(l, 0.01).viewer.ratio).toBe(0.15);
    expect(setViewerRatio(l, 0.9).viewer.ratio).toBe(0.6);
    expect(setViewerRatio(l, 0.35).viewer.ratio).toBe(0.35);
  });

  it('setViewerPath updates only path', () => {
    const l = openViewer(makeEmptyLayout(), 'a.ts');
    const next = setViewerPath(l, 'b.ts');
    expect(next.viewer.path).toBe('b.ts');
    expect(next.viewer.open).toBe(true);
  });
});
```

### Step 1.6 — Verification

- [ ] `pnpm typecheck` verde (3 tsconfigs — main, preload, renderer).
- [ ] `pnpm test:unit -- layout-viewer` verde.
- [ ] Commit: `feat(layout): extend WorktreeLayout with viewer state` + scope `files` también en el body si hay tipos compartidos.

### Commit (Task 1)

```
feat(layout): extend WorktreeLayout with viewer state

Add `viewer: { open, path, ratio }` to WorktreeLayout — third axis
for the upcoming file viewer. Hidration defaults the field when
absent so previously persisted layouts remain valid.

Wire new shared types (FileNode, FileReadResult, FileChangeEvent),
IPC channels (files:tree, files:read, files:open-in-viewer) and
events (files:change, files:status-changed). Preload exposes the
new files API.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
```

---

## Task 2: `src/main/files/ignore.ts` y `tree.ts`

**Files:**
- Create: `src/main/files/ignore.ts`
- Create: `src/main/files/tree.ts`
- Create: `tests/unit/main/files/tree.test.ts`

### Step 2.1 — `src/main/files/ignore.ts`

Predicado puro compartido por `tree.ts` y `watcher.ts`. Misma forma que el ignore de `src/main/projects/watcher.ts`:

```ts
const IGNORED_SEGMENTS = [
  '.git',
  'node_modules',
  'dist',
  'out',
  '.vite',
  '.next',
  'coverage',
  '.turbo',
  'target',
  'build',
] as const;

const IGNORED_NAMES = new Set<string>(['.DS_Store', 'Thumbs.db']);

/**
 * Returns true if the given POSIX relative path should be excluded from the
 * file tree and the watcher. Matches whole segments only — `src/.gitignore`
 * is NOT ignored just because '.git' appears as a substring.
 */
export function isIgnoredPath(relPath: string): boolean {
  if (relPath === '') return false;
  const segments = relPath.split('/');
  for (const segment of segments) {
    if (IGNORED_NAMES.has(segment)) return true;
    if ((IGNORED_SEGMENTS as readonly string[]).includes(segment)) return true;
  }
  return false;
}
```

### Step 2.2 — `src/main/files/tree.ts`

```ts
import { readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { FileNode } from '@shared/files';
import { isIgnoredPath } from './ignore.js';

function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}

/**
 * List immediate children of `absDirPath` inside the worktree rooted at
 * `repoRoot`. Filters via `isIgnoredPath`. Sort: dirs first (alphabetical),
 * then files (alphabetical). Case-insensitive comparison.
 */
export async function readChildren(absDirPath: string, repoRoot: string): Promise<FileNode[]> {
  const entries = await readdir(absDirPath, { withFileTypes: true });
  const out: FileNode[] = [];
  for (const entry of entries) {
    const abs = join(absDirPath, entry.name);
    const rel = toPosix(relative(repoRoot, abs));
    if (isIgnoredPath(rel)) continue;
    if (entry.isDirectory()) {
      out.push({ name: entry.name, relPath: rel, kind: 'dir', sizeBytes: null });
      continue;
    }
    if (entry.isFile() || entry.isSymbolicLink()) {
      let sizeBytes: number | null = null;
      try {
        const s = await stat(abs);
        sizeBytes = s.size;
      } catch {
        sizeBytes = null;
      }
      out.push({ name: entry.name, relPath: rel, kind: 'file', sizeBytes });
    }
  }
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return out;
}
```

### Step 2.3 — Tests (TDD)

`tests/unit/main/files/tree.test.ts` — usa `node:fs/promises` + un dir temporal en `os.tmpdir()`, igual patrón que tests de Fase 2 (`tests/unit/main/git/`). Cobertura:

- Repo con `src/`, `node_modules/`, `dist/`, `.git/` → `readChildren(root)` devuelve solo `src` (sin los ignored).
- `readChildren('src')` lista archivos correctamente.
- Sort: `A.ts`, `b.ts`, `Subdir/` → orden devuelto es `[Subdir, A.ts, b.ts]`.
- Archivo con permisos extraños no rompe (try/catch sobre stat).
- `.gitignore`, `.env`, `.config.json` NO se filtran (no están en la lista fija).
- Symlinks tratados como `file`.

```ts
// excerpt
it('hides ignored segments at any depth', async () => {
  await mkdir(join(root, 'pkg', 'node_modules', 'x'), { recursive: true });
  await writeFile(join(root, 'pkg', 'main.ts'), 'x');
  const children = await readChildren(join(root, 'pkg'), root);
  expect(children.map((c) => c.name)).toEqual(['main.ts']);
});

it('sorts dirs first then files alphabetically', async () => {
  await mkdir(join(root, 'alpha'), { recursive: true });
  await mkdir(join(root, 'Beta'), { recursive: true });
  await writeFile(join(root, 'zfile.ts'), 'x');
  await writeFile(join(root, 'Afile.ts'), 'x');
  const result = await readChildren(root, root);
  expect(result.map((r) => r.name)).toEqual(['alpha', 'Beta', 'Afile.ts', 'zfile.ts']);
});
```

### Step 2.4 — Verification

- [ ] `pnpm test:unit -- files/tree` verde.
- [ ] Commit: `feat(files): list worktree directories with fixed ignore filter`.

---

## Task 3: `src/main/files/reader.ts`

**Files:**
- Create: `src/main/files/reader.ts`
- Create: `tests/unit/main/files/reader.test.ts`

### Step 3.1 — Implementation

```ts
import { readFile as fsReadFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { MAX_FILE_BYTES, type FileReadResult } from '@shared/files';

const BINARY_EXTENSIONS = new Set<string>([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp', '.tiff',
  '.pdf', '.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z',
  '.exe', '.dll', '.dylib', '.so', '.wasm',
  '.mp4', '.mov', '.mkv', '.webm', '.mp3', '.wav', '.flac', '.ogg',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.psd', '.ai', '.sketch',
]);

/** Languages map: ext → shiki/highlight lang id. Conservative — unknown ext → null. */
const LANG_BY_EXT: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.json': 'json',
  '.md': 'markdown',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
  '.sh': 'bash',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.toml': 'toml',
};

function hasNullByte(buf: Buffer, sampleSize: number): boolean {
  const limit = Math.min(buf.byteLength, sampleSize);
  for (let i = 0; i < limit; i++) {
    if (buf[i] === 0x00) return true;
  }
  return false;
}

export async function readFile(absPath: string): Promise<FileReadResult> {
  let size: number;
  let ext: string;
  try {
    const s = await stat(absPath);
    if (!s.isFile()) return { kind: 'missing' };
    size = s.size;
    ext = extname(absPath).toLowerCase();
  } catch {
    return { kind: 'missing' };
  }

  if (BINARY_EXTENSIONS.has(ext)) {
    return { kind: 'binary', sizeBytes: size, ext };
  }
  if (size > MAX_FILE_BYTES) {
    return { kind: 'too-large', sizeBytes: size };
  }

  const buf = await fsReadFile(absPath);
  if (hasNullByte(buf, 8192)) {
    return { kind: 'binary', sizeBytes: size, ext };
  }
  return {
    kind: 'text',
    content: buf.toString('utf8'),
    lang: LANG_BY_EXT[ext] ?? null,
    sizeBytes: size,
  };
}
```

### Step 3.2 — Tests

Cobertura:
- Text file `<1MB` → `kind: 'text'` con `content` y `lang` correcto.
- Archivo `>1MB` → `kind: 'too-large'`.
- Archivo con extensión binaria → `kind: 'binary'` sin lectura.
- Archivo con null byte en primeros 8KB → `kind: 'binary'`.
- Path inexistente → `kind: 'missing'`.
- Directorio → `kind: 'missing'`.
- Archivo sin extensión con contenido texto → `kind: 'text'`, `lang: null`.

### Step 3.3 — Verification

- [ ] `pnpm test:unit -- files/reader` verde.
- [ ] Commit: `feat(files): read with size cap and binary detection`.

---

## Task 4: `src/main/files/git-status.ts`

**Files:**
- Create: `src/main/files/git-status.ts`
- Create: `tests/unit/main/files/git-status.test.ts`

### Step 4.1 — Implementation

`git status --porcelain=v1 -z` produce un stream NUL-separated. Cada entrada empieza con 2 chars (XY) + ' ' + path. En renames el formato es `R  newPath\0oldPath\0`. Para v1 nos basta con extraer la primera ruta de cada entrada y mapear el `X` (staged) y `Y` (worktree) a un único `GitFileStatus`. Priorizamos `Y` sobre `X` (cambios sin stagear son más visuales en el árbol).

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitFileStatus } from '@shared/files';

const exec = promisify(execFile);

/**
 * Returns a map relPath (POSIX) → status code. The map is sparse: only files
 * with a non-clean status are included.
 *
 * Status priority (worktree column first, then index column):
 *   '??' (untracked) > 'D' (deleted) > 'M' (modified) > 'A' (added) > 'R' (renamed) > 'C' (copied)
 */
export async function loadStatus(repoRoot: string): Promise<Map<string, GitFileStatus>> {
  const { stdout } = await exec(
    'git',
    ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
    { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024 },
  );
  return parsePorcelain(stdout);
}

export function parsePorcelain(stdout: string): Map<string, GitFileStatus> {
  const map = new Map<string, GitFileStatus>();
  // entries are NUL-separated; rename entries consume an extra NUL-terminated old-path.
  const buf = stdout;
  let i = 0;
  while (i < buf.length) {
    // every entry starts with: XY + ' ' + path + '\0'
    if (i + 3 > buf.length) break;
    const x = buf[i];
    const y = buf[i + 1];
    if (buf[i + 2] !== ' ') {
      // unexpected — abort defensively
      break;
    }
    i += 3;
    const end = buf.indexOf('\0', i);
    if (end === -1) break;
    const path = buf.slice(i, end);
    i = end + 1;
    // Renames/copies have an additional NUL-terminated old path
    if (x === 'R' || x === 'C') {
      const oldEnd = buf.indexOf('\0', i);
      if (oldEnd === -1) break;
      i = oldEnd + 1;
    }
    map.set(path, pickStatus(x, y));
  }
  return map;
}

function pickStatus(x: string, y: string): GitFileStatus {
  if (x === '?' && y === '?') return '??';
  // worktree column wins for visual badge
  if (y === 'M' || x === 'M') return 'M';
  if (y === 'A' || x === 'A') return 'A';
  if (y === 'D' || x === 'D') return 'D';
  if (x === 'R') return 'R';
  if (x === 'C') return 'C';
  if (y === 'U' || x === 'U') return 'U';
  return null;
}
```

### Step 4.2 — Tests

```ts
import { describe, expect, it } from 'vitest';
import { parsePorcelain } from '../../../../src/main/files/git-status';

describe('parsePorcelain', () => {
  it('parses a simple modified file', () => {
    const out = ' M src/foo.ts\0';
    const map = parsePorcelain(out);
    expect(map.get('src/foo.ts')).toBe('M');
  });

  it('parses untracked files', () => {
    const out = '?? new.ts\0?? other/x.ts\0';
    const map = parsePorcelain(out);
    expect(map.get('new.ts')).toBe('??');
    expect(map.get('other/x.ts')).toBe('??');
  });

  it('parses renamed files (skips the old path)', () => {
    // X=R, Y=' ', path=newName, then NUL, then oldName, NUL
    const out = 'R  new.ts\0old.ts\0 M after.ts\0';
    const map = parsePorcelain(out);
    expect(map.get('new.ts')).toBe('R');
    expect(map.get('after.ts')).toBe('M');
    expect(map.has('old.ts')).toBe(false);
  });

  it('worktree column wins over index for badge', () => {
    const out = 'MM src/foo.ts\0';
    const map = parsePorcelain(out);
    expect(map.get('src/foo.ts')).toBe('M');
  });

  it('handles paths with spaces', () => {
    const out = ' M src/has space.ts\0';
    const map = parsePorcelain(out);
    expect(map.get('src/has space.ts')).toBe('M');
  });
});
```

E2E con `loadStatus` sobre un repo tmp con commits + cambios: aborda en Task 13 (E2E).

### Step 4.3 — Verification

- [ ] `pnpm test:unit -- files/git-status` verde.
- [ ] Commit: `feat(files): parse git status --porcelain v1 -z`.

---

## Task 5: `src/main/files/watcher.ts`

**Files:**
- Create: `src/main/files/watcher.ts`
- Create: `tests/unit/main/files/watcher.test.ts`

### Step 5.1 — Implementation

Modelo: una instancia chokidar por worktree, suscrita a `path` del worktree, con `ignored` consultando `isIgnoredPath`. Eventos `add/change/unlink/addDir/unlinkDir` se agrupan en una `Map<relPath, FileChangeKind>` y se vacían cada 200ms via `setTimeout`. Si un path aparece varias veces dentro de la ventana, gana el último evento.

```ts
import chokidar, { type FSWatcher } from 'chokidar';
import { relative, sep } from 'node:path';
import type { FileChangeEvent, FileChangeKind } from '@shared/files';
import { isIgnoredPath } from './ignore.js';

function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}

export interface FileWatcherOptions {
  worktreeId: string;
  repoRoot: string;
  onEvent: (event: FileChangeEvent) => void;
  debounceMs?: number;
}

export interface FileWatcherHandle {
  dispose: () => Promise<void>;
}

const EVENT_MAP: Record<string, FileChangeKind> = {
  add: 'add',
  change: 'change',
  unlink: 'unlink',
  addDir: 'add-dir',
  unlinkDir: 'unlink-dir',
};

export function createFileWatcher(opts: FileWatcherOptions): FileWatcherHandle {
  const debounceMs = opts.debounceMs ?? 200;
  const pending = new Map<string, FileChangeKind>();
  let timer: NodeJS.Timeout | null = null;
  let disposed = false;

  const flush = (): void => {
    timer = null;
    if (disposed) return;
    for (const [relPath, kind] of pending) {
      opts.onEvent({ worktreeId: opts.worktreeId, relPath, kind });
    }
    pending.clear();
  };

  const handle = (raw: string) => (abs: string) => {
    const kind = EVENT_MAP[raw];
    if (!kind) return;
    const rel = toPosix(relative(opts.repoRoot, abs));
    if (rel === '' || rel.startsWith('..')) return;
    if (isIgnoredPath(rel)) return;
    pending.set(rel, kind);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };

  const watcher: FSWatcher = chokidar.watch(opts.repoRoot, {
    ignored: (absPath) => {
      const rel = toPosix(relative(opts.repoRoot, absPath));
      return isIgnoredPath(rel);
    },
    ignoreInitial: true,
    persistent: true,
    depth: 10,
  });

  for (const e of ['add', 'change', 'unlink', 'addDir', 'unlinkDir']) {
    watcher.on(e, handle(e));
  }
  watcher.on('error', (err) => {
    console.error('[files/watcher] error', err);
  });

  return {
    async dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      await watcher.close();
    },
  };
}
```

### Step 5.2 — Tests

Usa `tmpdir()` + `mkdir/writeFile/rm` + `await new Promise(r => setTimeout(r, 250))` después de cada acción para dejar pasar el debounce. Tests:

- Crear un archivo → llega evento `add` con relPath correcto.
- Modificar → `change`.
- Borrar → `unlink`.
- Crear archivo dentro de `node_modules` → NO llega evento (ignored).
- Múltiples cambios al mismo path en <200ms → un solo evento con el último kind.
- `dispose()` previene eventos posteriores.

> **Nota:** los tests de chokidar son a veces flaky en CI (fsevents/inotify latency). Usa `await waitFor(...)` con timeout 1.5s en lugar de sleeps fijos cuando puedas — patrón ya usado en `tests/unit/main/projects/watcher.test.ts` (si existe) o en setup helpers de Fase 2.

### Step 5.3 — Verification

- [ ] `pnpm test:unit -- files/watcher` verde.
- [ ] Commit: `feat(files): per-worktree filesystem watcher with debounced events`.

---

## Task 6: IPC handlers + `FileWatcherManager` + preload + lifecycle

**Files:**
- Create: `src/main/ipc/files.ts`
- Modify: `src/main/ipc/index.ts`
- Modify: `src/main/index.ts`

### Step 6.1 — `src/main/ipc/files.ts`

Tres responsabilidades:

1. Handlers `files:tree`, `files:read`, `files:open-in-viewer`.
2. `FileWatcherManager` — reconcilia watchers por `worktreeId` cuando se abren/cierran. Reusa el patrón de `src/main/projects/watcher.ts` (`reconcile(projects)`).
3. Reemisión periódica de `files:status-changed` debounced (300ms tras un `files:change`).

```ts
import { ipcMain, webContents, type BrowserWindow } from 'electron';
import { isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { readChildren } from '../files/tree.js';
import { readFile } from '../files/reader.js';
import { loadStatus } from '../files/git-status.js';
import { createFileWatcher, type FileWatcherHandle } from '../files/watcher.js';
import type { FileChangeEvent, GitFileStatus } from '@shared/files';
import type { Channel } from '@shared/ipc';

function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}

interface WorktreeContext {
  worktreeId: string;
  repoRoot: string;
}

export interface FileWatcherManager {
  ensure: (ctx: WorktreeContext) => void;
  release: (worktreeId: string) => void;
  disposeAll: () => Promise<void>;
}

export function registerFilesHandlers(
  getWorktreeRoot: (worktreeId: string) => string | null,
  mainWindow: () => BrowserWindow | null,
): FileWatcherManager {
  const handles = new Map<string, FileWatcherHandle>();
  const statusCache = new Map<string, Map<string, GitFileStatus>>();
  const statusTimers = new Map<string, NodeJS.Timeout>();

  const send = <T>(channel: string, payload: T): void => {
    const w = mainWindow();
    if (!w || w.isDestroyed()) return;
    w.webContents.send(channel, payload);
  };

  const scheduleStatusRefresh = (worktreeId: string, repoRoot: string): void => {
    const existing = statusTimers.get(worktreeId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      statusTimers.delete(worktreeId);
      void (async () => {
        try {
          const map = await loadStatus(repoRoot);
          const prev = statusCache.get(worktreeId) ?? new Map();
          const changes: Record<string, GitFileStatus> = {};
          for (const [p, s] of map) if (prev.get(p) !== s) changes[p] = s;
          for (const [p] of prev) if (!map.has(p)) changes[p] = null;
          statusCache.set(worktreeId, map);
          if (Object.keys(changes).length > 0) {
            send('files:status-changed', { worktreeId, changes });
          }
        } catch (err) {
          console.error('[files/ipc] status refresh failed', err);
        }
      })();
    }, 300);
    statusTimers.set(worktreeId, t);
  };

  const onChange = (event: FileChangeEvent): void => {
    send('files:change', event);
    const root = getWorktreeRoot(event.worktreeId);
    if (root) scheduleStatusRefresh(event.worktreeId, root);
  };

  ipcMain.handle('files:tree' satisfies Channel, async (_, req: { worktreeId: string; relPath: string | null }) => {
    const root = getWorktreeRoot(req.worktreeId);
    if (!root) return [];
    const abs = req.relPath ? join(root, req.relPath) : root;
    // Path traversal guard: abs must be inside root.
    const r = resolve(abs);
    const rootR = resolve(root);
    if (!r.startsWith(rootR + sep) && r !== rootR) return [];
    return await readChildren(r, rootR);
  });

  ipcMain.handle('files:read' satisfies Channel, async (_, req: { worktreeId: string; relPath: string }) => {
    const root = getWorktreeRoot(req.worktreeId);
    if (!root) return { kind: 'missing' };
    const abs = resolve(join(root, req.relPath));
    if (!abs.startsWith(resolve(root) + sep)) return { kind: 'missing' };
    return await readFile(abs);
  });

  ipcMain.handle(
    'files:open-in-viewer' satisfies Channel,
    async (_, req: { worktreeId: string; pathFromTool: string }) => {
      const root = getWorktreeRoot(req.worktreeId);
      if (!root) return null;
      const abs = isAbsolute(req.pathFromTool)
        ? normalize(req.pathFromTool)
        : resolve(join(root, req.pathFromTool));
      const rootR = resolve(root);
      if (!abs.startsWith(rootR + sep) && abs !== rootR) return null;
      const rel = toPosix(relative(rootR, abs));
      if (rel === '') return null;
      return { relPath: rel };
    },
  );

  return {
    ensure({ worktreeId, repoRoot }) {
      if (handles.has(worktreeId)) return;
      const handle = createFileWatcher({ worktreeId, repoRoot, onEvent: onChange });
      handles.set(worktreeId, handle);
      // Prime status cache so the first files:status-changed has a baseline.
      void loadStatus(repoRoot)
        .then((m) => statusCache.set(worktreeId, m))
        .catch(() => undefined);
    },
    release(worktreeId) {
      const h = handles.get(worktreeId);
      if (!h) return;
      handles.delete(worktreeId);
      statusCache.delete(worktreeId);
      const t = statusTimers.get(worktreeId);
      if (t) {
        clearTimeout(t);
        statusTimers.delete(worktreeId);
      }
      h.dispose().catch((err) => console.error('[files/ipc] dispose failed', err));
    },
    async disposeAll() {
      for (const t of statusTimers.values()) clearTimeout(t);
      statusTimers.clear();
      const arr = [...handles.values()];
      handles.clear();
      statusCache.clear();
      await Promise.all(arr.map((h) => h.dispose().catch(() => undefined)));
    },
  };
}
```

**Path traversal guard:** crítico. Si un tool message viene con `pathFromTool = '../../etc/passwd'`, el handler debe devolver `null`. Test E2E lo cubre. La condición es `abs.startsWith(rootR + sep)` con `resolve` previo — exactamente el mismo patrón que validaciones de `files:tree`.

### Step 6.2 — Wiring en `src/main/index.ts`

```ts
const filesManager = registerFilesHandlers(
  (worktreeId) => projectsState.getWorktreeRoot(worktreeId),
  () => mainWindow,
);

// When the renderer signals interest in a worktree (e.g., openTab), call ensure().
// When tabs close (already wired), call release().
// app.on('before-quit', async (e) => {
//   if (alreadyDraining) return;
//   alreadyDraining = true;
//   e.preventDefault();
//   await filesManager.disposeAll();
//   await ptyManager.killAll();
//   await persistSessions();
//   app.quit();
// });
```

> **Importante:** la integración con `before-quit` debe coordinarse con el cleanup ya existente de Fase 6 (PtyManager). Misma `e.preventDefault()` + `await` antes de re-disparar `app.quit()`. Reutilizar la promesa de drain en lugar de bloquear dos veces.

`projectsState.getWorktreeRoot` puede no existir todavía. Si no existe, añadirlo: dado un `worktreeId`, devolver el `path` del worktree mirando dentro del store / cache de Fase 2.

### Step 6.3 — Trigger de `ensure` y `release`

Política: un watcher por **tab abierto**, no por worktree existente. Cuando se abre una tab, llamar `filesManager.ensure(...)`. Cuando se cierra, `filesManager.release(...)`. Si no hay tab abierta para un worktree, no hay watcher de files (sin desperdiciar fd).

Implementación: añadir hooks en el handler IPC que gestiona apertura/cierre de tabs (probablemente parte de `useTabs` + un canal `tabs:opened` / `tabs:closed`, o más simple: side-effect del renderer que llama dos canales nuevos `files:watch:start` / `files:watch:stop`).

**Decisión simplificadora:** en lugar de añadir nuevos canales, hacer que `files:tree` con `relPath === null` (= primera llamada para ese worktree) dispare implícitamente `ensure`, y `files:watch:stop` se omite — los watchers se limpian al cerrar app. Coste: si abres 50 worktrees en una sesión y los cierras todos menos uno, mantienes 50 watchers vivos. Mitigación: Fase 8 (atajos) tendrá un mejor lifecycle.

Para Fase 7 dejamos: **`files:tree` dispara `ensure(ctx)` perezoso** (idempotente). `release` solo en `disposeAll` al salir de la app.

### Step 6.4 — Verification

- [ ] Build de main verde (`pnpm typecheck`).
- [ ] Test manual: dispara `files:tree` desde devtools de renderer y verifica que el resultado se imprime.
- [ ] Commit: `feat(files): ipc handlers, watcher manager and renderer-side wiring`.

---

## Task 7: Hook `useFileTree` y `useFileContent`

**Files:**
- Create: `src/renderer/src/shortcuts/useFileTree.ts`
- Create: `src/renderer/src/shortcuts/useFileContent.ts`
- Modify: `src/renderer/src/shortcuts/useWorktreeLayout.ts` (añadir ops viewer)

### Step 7.1 — Ops del visor en `useWorktreeLayout`

Extiende `WorktreeLayoutOps`:

```ts
export interface WorktreeLayoutOps {
  // ... existing ops
  toggleViewer: () => void;
  openViewer: (path: string | null) => void;
  closeViewer: () => void;
  setViewerPath: (path: string | null) => void;
  setViewerRatio: (ratio: number) => void;
}
```

Cada uno con el patrón habitual: `setLayout((prev) => ...)` + `schedulePersist(worktreeId, next)`.

Y en la hidratación (`useEffect` actual), tras leer `stored`:

```ts
const viewer = stored.viewer ?? { open: false, path: null, ratio: 0.28 };
setLayout({ ...stored, panes: prunedPanes, activePaneId, viewer });
```

### Step 7.2 — `useFileTree.ts`

Estado: `expanded: Set<string>` (paths expandidos). `childrenCache: Map<string, FileNode[]>`. `statusMap: Map<string, GitFileStatus>`.

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FileNode, FileChangeEvent, GitFileStatus, FileStatusChangeEvent } from '@shared/files';

export interface FlatTreeRow {
  node: FileNode;
  /** Depth from root (root = 0). Used for indent. */
  depth: number;
  isExpanded: boolean;
  status: GitFileStatus;
}

export interface UseFileTree {
  rows: FlatTreeRow[];
  loadingRoot: boolean;
  toggleExpand: (relPath: string) => void;
  refresh: () => void;
}

export function useFileTree(worktreeId: string | null): UseFileTree {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set<string>(['']));
  const [children, setChildren] = useState<Map<string, FileNode[]>>(() => new Map());
  const [status, setStatus] = useState<Map<string, GitFileStatus>>(() => new Map());
  const [loadingRoot, setLoadingRoot] = useState(false);

  const wtRef = useRef<string | null>(worktreeId);
  wtRef.current = worktreeId;

  const fetchChildren = useCallback(async (relPath: string | null): Promise<void> => {
    if (!worktreeId) return;
    const key = relPath ?? '';
    if (key === '') setLoadingRoot(true);
    try {
      const nodes = await window.jide.files.tree(worktreeId, relPath);
      setChildren((prev) => {
        const next = new Map(prev);
        next.set(key, nodes);
        return next;
      });
    } finally {
      if (key === '') setLoadingRoot(false);
    }
  }, [worktreeId]);

  useEffect(() => {
    setExpanded(new Set<string>(['']));
    setChildren(new Map());
    setStatus(new Map());
    void fetchChildren(null);
  }, [worktreeId, fetchChildren]);

  useEffect(() => {
    if (!worktreeId) return;
    const off = window.jide.on('files:change', (event: FileChangeEvent) => {
      if (event.worktreeId !== worktreeId) return;
      // Invalidate the parent directory of the changed path
      const parent = event.relPath.includes('/') ? event.relPath.replace(/\/[^/]*$/, '') : '';
      void fetchChildren(parent === '' ? null : parent);
    });
    return off;
  }, [worktreeId, fetchChildren]);

  useEffect(() => {
    if (!worktreeId) return;
    const off = window.jide.on('files:status-changed', (e: FileStatusChangeEvent) => {
      if (e.worktreeId !== worktreeId) return;
      setStatus((prev) => {
        const next = new Map(prev);
        for (const [p, s] of Object.entries(e.changes)) {
          if (s === null) next.delete(p);
          else next.set(p, s);
        }
        return next;
      });
    });
    return off;
  }, [worktreeId]);

  const toggleExpand = useCallback((relPath: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) {
        next.delete(relPath);
      } else {
        next.add(relPath);
        if (!children.has(relPath)) void fetchChildren(relPath);
      }
      return next;
    });
  }, [children, fetchChildren]);

  const rows = useMemo<FlatTreeRow[]>(() => {
    const out: FlatTreeRow[] = [];
    const walk = (parent: string, depth: number): void => {
      const list = children.get(parent) ?? [];
      for (const node of list) {
        const isExpanded = expanded.has(node.relPath);
        out.push({ node, depth, isExpanded, status: status.get(node.relPath) ?? null });
        if (node.kind === 'dir' && isExpanded) walk(node.relPath, depth + 1);
      }
    };
    walk('', 0);
    return out;
  }, [children, expanded, status]);

  return {
    rows,
    loadingRoot,
    toggleExpand,
    refresh: () => { void fetchChildren(null); },
  };
}
```

### Step 7.3 — `useFileContent.ts`

```ts
import { useEffect, useState } from 'react';
import type { FileReadResult, FileChangeEvent } from '@shared/files';

export interface UseFileContent {
  result: FileReadResult | null;
  loading: boolean;
}

export function useFileContent(worktreeId: string | null, relPath: string | null): UseFileContent {
  const [result, setResult] = useState<FileReadResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!worktreeId || !relPath) {
      setResult(null);
      return;
    }
    let alive = true;
    setLoading(true);
    void window.jide.files.read(worktreeId, relPath)
      .then((res) => { if (alive) setResult(res); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [worktreeId, relPath]);

  useEffect(() => {
    if (!worktreeId || !relPath) return;
    const off = window.jide.on('files:change', (event: FileChangeEvent) => {
      if (event.worktreeId !== worktreeId || event.relPath !== relPath) return;
      if (event.kind === 'unlink') {
        setResult({ kind: 'missing' });
        return;
      }
      void window.jide.files.read(worktreeId, relPath).then(setResult);
    });
    return off;
  }, [worktreeId, relPath]);

  return { result, loading };
}
```

### Step 7.4 — Verification

- [ ] `pnpm typecheck` verde.
- [ ] Test ligero (vitest + testing-library): mount `useFileTree` con un `worktreeId` mockeado via `vi.stubGlobal('window.jide', ...)`, expand root, verifica que `rows` contiene los nodos esperados.
- [ ] Commit: `feat(viewer): hooks for file tree and content with live reload`.

---

## Task 8: `FileTree`, `FileTreeNode`, `FileBadge` (virtualizado >500)

**Files:**
- Create: `src/renderer/src/components/FileViewer/FileTree.tsx`
- Create: `src/renderer/src/components/FileViewer/FileTreeNode.tsx`
- Create: `src/renderer/src/components/FileViewer/FileBadge.tsx`
- Modify: `package.json` (+`react-window`, +`@types/react-window`)

### Step 8.1 — `package.json`

```
"dependencies": {
  ...
  "react-window": "^1.8.10"
},
"devDependencies": {
  ...
  "@types/react-window": "^1.8.8"
}
```

### Step 8.2 — `FileBadge.tsx`

```tsx
import type { JSX } from 'react';
import type { GitFileStatus } from '@shared/files';
import { useTheme } from '../../theme/useTheme';

export interface FileBadgeProps {
  status: GitFileStatus;
}

export function FileBadge({ status }: FileBadgeProps): JSX.Element | null {
  const { theme, accent } = useTheme();
  if (!status) return null;
  const color: string = status === '??' ? theme.warning
    : status === 'D' ? theme.error
    : status === 'M' ? accent.value
    : status === 'A' ? theme.success
    : theme.muted;
  return (
    <span
      style={{
        color,
        fontFamily: theme.fontMono,
        fontSize: 10,
        marginLeft: 6,
        opacity: 0.9,
        minWidth: 14,
        textAlign: 'right',
      }}
    >
      {status}
    </span>
  );
}
```

> Si `theme.warning` / `theme.success` no existen aún en `src/shared/theme.ts`, esta task los añade (`warning`, `success`) usando los mismos tonos del mock — Task 8 toca `theme.ts` solo para añadirlos si faltan. Verificar primero.

### Step 8.3 — `FileTreeNode.tsx`

```tsx
import type { JSX } from 'react';
import type { FlatTreeRow } from '../../shortcuts/useFileTree';
import { useTheme } from '../../theme/useTheme';
import { FileBadge } from './FileBadge';

export interface FileTreeNodeProps {
  row: FlatTreeRow;
  selected: boolean;
  onToggleExpand: (relPath: string) => void;
  onSelect: (relPath: string) => void;
}

export function FileTreeNode({ row, selected, onToggleExpand, onSelect }: FileTreeNodeProps): JSX.Element {
  const { theme, accent } = useTheme();
  const { node, depth, isExpanded } = row;

  const handleClick = (): void => {
    if (node.kind === 'dir') {
      onToggleExpand(node.relPath);
      return;
    }
    onSelect(node.relPath);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 8 + depth * 12,
        paddingRight: 8,
        height: 22,
        cursor: 'pointer',
        background: selected ? accent.softBg : undefined,
        color: theme.text,
        fontSize: 12,
      }}
    >
      <span style={{ width: 12, color: theme.muted, fontSize: 10, textAlign: 'center' }}>
        {node.kind === 'dir' ? (isExpanded ? '▾' : '▸') : ' '}
      </span>
      <span style={{ marginLeft: 4, color: node.kind === 'dir' ? theme.text : theme.subtle }}>
        {node.name}
      </span>
      <span style={{ flex: 1 }} />
      <FileBadge status={row.status} />
    </div>
  );
}
```

### Step 8.4 — `FileTree.tsx`

```tsx
import type { JSX } from 'react';
import { FixedSizeList } from 'react-window';
import type { UseFileTree } from '../../shortcuts/useFileTree';
import { FileTreeNode } from './FileTreeNode';
import { useTheme } from '../../theme/useTheme';

const VIRTUALIZE_THRESHOLD = 500;
const ROW_HEIGHT = 22;

export interface FileTreeProps extends UseFileTree {
  height: number;
  selectedPath: string | null;
  onSelect: (relPath: string) => void;
}

export function FileTree({
  rows, toggleExpand, height, selectedPath, onSelect, loadingRoot,
}: FileTreeProps): JSX.Element {
  const { theme } = useTheme();

  if (loadingRoot && rows.length === 0) {
    return <div style={{ padding: 12, color: theme.subtle, fontSize: 12 }}>Cargando…</div>;
  }
  if (rows.length === 0) {
    return <div style={{ padding: 12, color: theme.subtle, fontSize: 12 }}>(vacío)</div>;
  }

  if (rows.length < VIRTUALIZE_THRESHOLD) {
    return (
      <div style={{ overflow: 'auto', height }}>
        {rows.map((row) => (
          <FileTreeNode
            key={row.node.relPath}
            row={row}
            selected={selectedPath === row.node.relPath}
            onToggleExpand={toggleExpand}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  return (
    <FixedSizeList
      height={height}
      itemCount={rows.length}
      itemSize={ROW_HEIGHT}
      width="100%"
    >
      {({ index, style }) => {
        const row = rows[index];
        return (
          <div style={style} key={row.node.relPath}>
            <FileTreeNode
              row={row}
              selected={selectedPath === row.node.relPath}
              onToggleExpand={toggleExpand}
              onSelect={onSelect}
            />
          </div>
        );
      }}
    </FixedSizeList>
  );
}
```

`height` se inyecta desde el padre con un `ResizeObserver` (igual patrón que `useXterm` de Fase 6).

### Step 8.5 — Verification

- [ ] Snapshot test del `FileTree` con 3 nodos.
- [ ] Commit: `feat(viewer): file tree with git status badges and virtualization`.

---

## Task 9: `FileContent` + `useShiki` + placeholders

**Files:**
- Create: `src/renderer/src/components/FileViewer/useShiki.ts`
- Create: `src/renderer/src/components/FileViewer/FileContent.tsx`
- Create: `src/renderer/src/components/FileViewer/BinaryFilePlaceholder.tsx`
- Create: `src/renderer/src/components/FileViewer/TooLargePlaceholder.tsx`
- Create: `src/renderer/src/components/FileViewer/EmptyViewer.tsx`
- Modify: `package.json` (+`shiki`)

### Step 9.1 — `useShiki.ts`

Carga dinámica + caché por theme. El highlighter se crea una vez (`getHighlighter` es asíncrono y pesado).

```ts
import { useEffect, useState } from 'react';
import type { Highlighter, BundledLanguage } from 'shiki';

const LANGS: BundledLanguage[] = [
  'typescript', 'tsx', 'javascript', 'jsx', 'json', 'markdown',
  'css', 'scss', 'html', 'bash', 'python', 'rust', 'go', 'yaml', 'toml',
];

let cached: Promise<Highlighter> | null = null;

function loadHighlighter(): Promise<Highlighter> {
  if (cached) return cached;
  cached = (async () => {
    const { getHighlighter } = await import('shiki');
    return getHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: LANGS,
    });
  })();
  return cached;
}

export interface UseShiki {
  highlighter: Highlighter | null;
  ready: boolean;
}

export function useShiki(): UseShiki {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  useEffect(() => {
    let alive = true;
    void loadHighlighter().then((hl) => { if (alive) setHighlighter(hl); });
    return () => { alive = false; };
  }, []);
  return { highlighter, ready: highlighter !== null };
}
```

### Step 9.2 — `FileContent.tsx`

```tsx
import type { JSX } from 'react';
import { useMemo } from 'react';
import type { FileReadResult } from '@shared/files';
import { useTheme } from '../../theme/useTheme';
import { useShiki } from './useShiki';
import { BinaryFilePlaceholder } from './BinaryFilePlaceholder';
import { TooLargePlaceholder } from './TooLargePlaceholder';

export interface FileContentProps {
  result: FileReadResult | null;
  loading: boolean;
}

export function FileContent({ result, loading }: FileContentProps): JSX.Element {
  const { theme } = useTheme();
  const { highlighter, ready } = useShiki();

  const html = useMemo<string | null>(() => {
    if (!result || result.kind !== 'text') return null;
    if (!ready || !highlighter) return null;
    try {
      return highlighter.codeToHtml(result.content, {
        lang: result.lang ?? 'text',
        theme: theme.kind === 'dark' ? 'github-dark' : 'github-light',
      });
    } catch {
      return null;
    }
  }, [result, highlighter, ready, theme.kind]);

  if (loading || !result) {
    return <div style={{ padding: 12, color: theme.subtle, fontSize: 12 }}>Cargando…</div>;
  }

  if (result.kind === 'missing') {
    return <div style={{ padding: 12, color: theme.subtle, fontSize: 12 }}>Archivo no encontrado.</div>;
  }
  if (result.kind === 'binary') {
    return <BinaryFilePlaceholder ext={result.ext} sizeBytes={result.sizeBytes} />;
  }
  if (result.kind === 'too-large') {
    return <TooLargePlaceholder sizeBytes={result.sizeBytes} />;
  }

  if (html) {
    return (
      <div
        style={{
          overflow: 'auto',
          fontSize: 12,
          fontFamily: theme.fontMono,
          padding: 0,
          background: theme.codeBg,
        }}
        // shiki HTML is sanitized output of its own renderer — no user-supplied HTML
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // shiki not ready yet — render plain pre
  return (
    <pre
      style={{
        margin: 0,
        padding: 12,
        fontSize: 12,
        fontFamily: theme.fontMono,
        color: theme.text,
        background: theme.codeBg,
        whiteSpace: 'pre',
        overflow: 'auto',
      }}
    >
      {result.content}
    </pre>
  );
}
```

> **Security note:** `dangerouslySetInnerHTML` con shiki es seguro porque shiki produce HTML controlado a partir de strings; no inyecta input del usuario sin sanitizar. La string es contenido del archivo, que sí es controlado por el dev. Como no es input remoto, el riesgo de XSS es nulo. Reglamento (línea de `~/.claude/CLAUDE.md`): **no comments**, salvo este "why" no obvio que dejo arriba del bloque `dangerouslySetInnerHTML`.

### Step 9.3 — `BinaryFilePlaceholder.tsx` y `TooLargePlaceholder.tsx`

```tsx
// BinaryFilePlaceholder.tsx
import type { JSX } from 'react';
import { useTheme } from '../../theme/useTheme';

export function BinaryFilePlaceholder({ ext, sizeBytes }: { ext: string; sizeBytes: number }): JSX.Element {
  const { theme } = useTheme();
  return (
    <div style={{ padding: 24, color: theme.subtle, fontSize: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
      <div>Archivo binario ({ext || 'sin extensión'}) — {formatSize(sizeBytes)}</div>
      <div style={{ marginTop: 4 }}>No se puede previsualizar.</div>
    </div>
  );
}

function formatSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
```

`TooLargePlaceholder.tsx`: mismo patrón, mensaje "Archivo demasiado grande (X) — vista deshabilitada".

`EmptyViewer.tsx`: "Selecciona un archivo del árbol o cierra el visor con ⌘O."

### Step 9.4 — `package.json` y rebuild

```
"dependencies": {
  ...
  "shiki": "^1.22.0"
}
```

`pnpm install`. Verificar que el bundle del renderer NO incluye shiki en el chunk principal — Vite hace code-splitting automático en `import('shiki')` dentro de `useShiki`. Inspeccionar `dist/renderer/_assets/` tras un `pnpm build:renderer` debería mostrar un chunk `shiki-*.js` separado.

### Step 9.5 — Verification

- [ ] `pnpm typecheck` verde.
- [ ] Snapshot test `FileContent` con `result.kind === 'binary'`.
- [ ] Manual: abrir un `.ts` en el visor con el theme en `dark` → resaltado correcto. Cambiar a `light` → cambia el theme sin reload.
- [ ] Commit: `feat(viewer): file content with shiki highlight and binary/too-large placeholders`.

---

## Task 10: `FileViewerPanel`

**Files:**
- Create: `src/renderer/src/components/FileViewer/FileViewerPanel.tsx`

### Step 10.1 — Composición

```tsx
import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../theme/useTheme';
import { useFileTree } from '../../shortcuts/useFileTree';
import { useFileContent } from '../../shortcuts/useFileContent';
import { FileTree } from './FileTree';
import { FileContent } from './FileContent';
import { SplitContainer } from '../Worktree/SplitContainer';
import { EmptyViewer } from './EmptyViewer';

export interface FileViewerPanelProps {
  worktreeId: string;
  selectedPath: string | null;
  onSelect: (relPath: string) => void;
  onClose: () => void;
}

export function FileViewerPanel({
  worktreeId, selectedPath, onSelect, onClose,
}: FileViewerPanelProps): JSX.Element {
  const { theme } = useTheme();
  const treeApi = useFileTree(worktreeId);
  const contentApi = useFileContent(worktreeId, selectedPath);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const [treeHeight, setTreeHeight] = useState(400);

  useEffect(() => {
    const el = treeContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      setTreeHeight(Math.max(50, h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: theme.surface,
        borderRight: `1px solid ${theme.borderHair}`,
        minWidth: 0,
      }}
      data-testid="file-viewer-panel"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          height: 32,
          fontSize: 11,
          color: theme.subtle,
          borderBottom: `1px solid ${theme.borderHair}`,
        }}
      >
        <span>Visor</span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar visor"
          style={{
            background: 'transparent',
            border: 'none',
            color: theme.subtle,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          ×
        </button>
      </div>
      <SplitContainer
        axis="h"
        ratio={0.4}
        first={
          <div ref={treeContainerRef} style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
            <FileTree
              {...treeApi}
              height={treeHeight}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          </div>
        }
        second={
          selectedPath ? (
            <FileContent result={contentApi.result} loading={contentApi.loading} />
          ) : (
            <EmptyViewer />
          )
        }
      />
    </div>
  );
}
```

### Step 10.2 — Verification

- [ ] `pnpm typecheck` verde.
- [ ] Snapshot básico del panel.
- [ ] Commit: `feat(viewer): compose FileViewerPanel with tree + content`.

---

## Task 11: Refactor de `WorktreeView` — tercer eje

**Files:**
- Modify: `src/renderer/src/components/Worktree/WorktreeView.tsx`

### Step 11.1 — Layout de 3 ejes

La regla de composición es:

- Si `viewer.open === false` → reusa la lógica actual (chat solo / chat + terminal).
- Si `viewer.open === true` → wrap externo `<SplitContainer axis='v' ratio={viewer.ratio}>{Viewer}{...interior}</SplitContainer>`, donde `interior` es la composición actual (chat / chat+terminal).

```tsx
import type { JSX } from 'react';
import type { Worktree } from '@shared/project';
import type { WorktreeLayout } from '@shared/layout';
import type { WorktreeLayoutOps } from '../../shortcuts/useWorktreeLayout';
import { ChatPanel } from '../Chat/ChatPanel';
import { TerminalPanel } from '../Terminal/TerminalPanel';
import { FileViewerPanel } from '../FileViewer/FileViewerPanel';
import { SplitContainer } from './SplitContainer';

export interface WorktreeViewProps {
  worktreeId: string | null;
  worktree: Worktree | null;
  shellName: string;
  maxSessionsPerWorktree: number;
  layout: WorktreeLayout;
  ops: WorktreeLayoutOps;
}

export function WorktreeView({
  worktreeId, worktree, shellName, maxSessionsPerWorktree, layout, ops,
}: WorktreeViewProps): JSX.Element {
  const chat = (
    <ChatPanel
      worktreeId={worktreeId}
      maxSessionsPerWorktree={maxSessionsPerWorktree}
      layout={layout}
      ops={ops}
    />
  );

  const chatPlusTerminal = (worktreeId && worktree && layout.terminal !== 'off')
    ? (
      <SplitContainer
        axis={layout.terminal === 'bottom' ? 'h' : 'v'}
        ratio={layout.terminalRatio}
        first={chat}
        second={
          <TerminalPanel
            worktreeId={worktreeId}
            cwd={worktree.path}
            shellName={shellName}
            orientation={layout.terminal}
            onToggleOrientation={ops.toggleTerminalOrientation}
            onClose={ops.closeTerminal}
          />
        }
      />
    )
    : chat;

  if (!worktreeId || !layout.viewer.open) {
    return chatPlusTerminal;
  }

  return (
    <SplitContainer
      axis="v"
      ratio={layout.viewer.ratio}
      first={
        <FileViewerPanel
          worktreeId={worktreeId}
          selectedPath={layout.viewer.path}
          onSelect={(relPath) => ops.setViewerPath(relPath)}
          onClose={ops.closeViewer}
        />
      }
      second={chatPlusTerminal}
    />
  );
}
```

### Step 11.2 — Verification

- [ ] `pnpm typecheck`.
- [ ] Manual: abrir la app, abrir un worktree, `⌘O` (todavía no wired → siguiente task), verifica via devtools state.
- [ ] Commit: `feat(viewer): wire WorktreeView third axis for file viewer`.

---

## Task 12: Hotkey `⌘O` + click desde `ToolMessage`

**Files:**
- Modify: `src/renderer/src/shortcuts/useGlobalShortcuts.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/components/Chat/ToolMessage.tsx`

### Step 12.1 — `useGlobalShortcuts`

```ts
export interface GlobalShortcutHandlers {
  onToggleTweaks?: () => void;
  onNewWorktree?: () => void;
  onEscape?: () => void;
  onToggleTerminal?: () => void;
  onToggleViewer?: () => void;
}

// inside useEffect:
if (mod && (e.key === 'o' || e.key === 'O')) {
  e.preventDefault();
  handlers.onToggleViewer?.();
  return;
}
```

### Step 12.2 — `App.tsx`

```tsx
const handlers = useMemo<GlobalShortcutHandlers>(() => ({
  // ... existing
  onToggleTerminal: () => ops.cycleTerminal(),
  onToggleViewer: () => ops.toggleViewer(),
}), [/* deps */]);
```

### Step 12.3 — `ToolMessage` clickable

`ToolMessage` actualmente detecta `input.file_path` / `input.path` en `formatInput`. Modificar para exponer el path candidato y hacer la cabecera clickable.

```tsx
function extractFilePath(input: Record<string, unknown>): string | null {
  if (typeof input.file_path === 'string') return input.file_path;
  if (typeof input.path === 'string') return input.path;
  return null;
}

export function ToolMessage({ message, onOpenFile }: ToolMessageProps): JSX.Element {
  const filePath = extractFilePath(message.input);
  // ... cabecera renderizada como <button> si filePath !== null y onOpenFile está definido
  <button
    type="button"
    onClick={filePath && onOpenFile ? () => onOpenFile(filePath) : undefined}
    disabled={!filePath || !onOpenFile}
    style={{ ...headerStyle, cursor: filePath ? 'pointer' : 'default', background: 'transparent', border: 'none' }}
    aria-label={filePath ? `Abrir ${filePath} en el visor` : undefined}
  >
    ...
  </button>
```

`ChatPanel` recibe `onOpenFile?: (path: string) => void` como prop y se lo pasa a `Message → ToolMessage`. El callback en `App.tsx` es:

```ts
const onOpenFile = useCallback(async (toolPath: string) => {
  if (!activeWorktreeId) return;
  const res = await window.jide.files.openInViewer(activeWorktreeId, toolPath);
  if (!res) {
    console.warn('[viewer] path outside worktree, ignored:', toolPath);
    return;
  }
  ops.openViewer(res.relPath);
}, [activeWorktreeId, ops]);
```

Y se pasa hasta `ToolMessage` por props cadena `WorktreeView → ChatPanel → ChatGrid → ChatPane → Message → ToolMessage`. Si la cadena es larga, alternativa: context. Para Fase 7 propagamos por props (4 niveles, manejable).

### Step 12.4 — Verification

- [ ] `pnpm typecheck`.
- [ ] Manual: `⌘O` abre/cierra; click en una tarjeta tool con `file_path` abre ese archivo.
- [ ] Commit: `feat(viewer): toggle with ⌘O and open files from tool messages`.

---

## Task 13: E2E + final audit + DoD

**Files:**
- Create: `tests/e2e/file-viewer.spec.ts`

### Step 13.1 — E2E

`file-viewer.spec.ts`:

1. **Setup:** crear un repo tmp con `git init`, commit inicial con `src/foo.ts`, `README.md`, `node_modules/x/y.ts`, `dist/output.js`. Añadir el repo como proyecto, abrir un worktree.
2. **⌘O abre el visor:** assert que el panel `[data-testid="file-viewer-panel"]` está visible. Assert que el árbol muestra `src/` y `README.md` pero NO `node_modules` ni `dist`.
3. **Expand `src/`:** click en la fila `src/` → aparece `foo.ts`.
4. **Click en `foo.ts`:** assert que el contenido se muestra (texto del fixture).
5. **Modificación externa:** desde el test, sobrescribir `foo.ts` con `'export const X = 42;'`. Esperar a que el contenido del visor cambie (poll <2s).
6. **Git status badge:** assert que tras la modificación aparece un badge `M` en la fila `foo.ts` (poll <1s).
7. **Binary:** crear un `image.png` con bytes binarios → click muestra `BinaryFilePlaceholder`.
8. **Tool message click:** simular un `ToolMessage` con `input.file_path = 'src/foo.ts'`, click en la cabecera → visor se abre/navega a ese archivo.
9. **Path traversal:** llamar `window.jide.files.openInViewer(wt, '../../etc/passwd')` desde devtools del test → assert que devuelve `null`.
10. **⌘O cierra:** segundo `⌘O` → `[data-testid="file-viewer-panel"]` desaparece.
11. **Persist:** reload de la página → visor reabierto con `selectedPath` recordado.

### Step 13.2 — Final audit

- [ ] Comparar visualmente con el mock (`design/project/jide/terminal.jsx` — sección `FileViewerPanel`): paddings, badges, jerarquía. Discrepancias > 4px se corrigen.
- [ ] DoD Fase 7 (del ROADMAP):
  - [ ] ⌘O abre el visor mostrando árbol + último archivo abierto.
  - [ ] Cambiar un archivo externamente actualiza el árbol y el contenido si está abierto.
  - [ ] Archivos modificados (`M`) y nuevos (`A` / `??`) llevan badge de color.
  - [ ] No se puede editar — render `<pre>` (shiki) sin `contenteditable`.
  - [ ] Click en `file` de una tarjeta tool del chat abre ese archivo.
- [ ] `pnpm typecheck` verde en los 3 tsconfigs.
- [ ] `pnpm test:unit` verde.
- [ ] `pnpm test:e2e` verde.
- [ ] `pnpm lint` verde.
- [ ] `pnpm build` (compone todo) verde.

### Step 13.3 — PR

```bash
gh pr create --title "feat: fase 7 — file viewer read-only + watcher" --body "..."
```

Cuerpo del PR (HEREDOC):
- Resumen: 3-4 bullets de lo que añade.
- Decisiones cerradas (table-summary).
- Test plan: pasos manuales reproducibles.
- Screenshots/screencast del visor abierto en light + dark.

---

## Apéndice A — Theme tokens necesarios

Si `src/shared/theme.ts` no tiene aún `warning`, `success`, `codeBg`, `subtle`, los añade Task 8 (o esta task si surge antes):

```ts
export interface Theme {
  ...
  warning: string;        // amber-ish (e.g. '#D08C00' light, '#FFC857' dark)
  success: string;        // green ('#3F8F3F' light, '#79D17F' dark)
  codeBg: string;         // codeBg already exists per Fase 6 — reusar
  subtle: string;         // already exists
}
```

Verificar antes de ejecutar Task 8.

---

## Apéndice B — Riesgos y mitigaciones

1. **Shiki bundle pesa (~3.5MB) tras cargar dynamic import.** Mitigación: solo se carga la primera vez que se abre un archivo de texto. El primer paint del visor (mientras shiki carga) usa el fallback `<pre>` plano sin highlight — UX aceptable.

2. **Path traversal en `files:read` y `files:open-in-viewer`.** Cubierto: `resolve` + `startsWith(rootR + sep)` antes de leer / antes de devolver. Cobertura E2E explícita.

3. **Watcher de Fase 2 + Fase 7 simultáneos en monorepos = 2× fd cost.** Mitigación: lista fija de ignores hardcoded incluye `node_modules`, `dist`, etc. Para repos >100k archivos visibles, considerar en Fase 9 un toggle "low-fd mode" que use polling. No bloquea v1.

4. **`react-window` necesita `height` explícito.** Wraper `ResizeObserver` en `FileViewerPanel` ya cubre.

5. **`git status --porcelain -z`** en repos enormes puede tardar segundos. El debounce de 300ms tras eventos `files:change` amortigua picos, pero el primer load puede sentirse lento. Mitigación: priming async (Task 6 `ensure` lanza `loadStatus` en paralelo, no bloquea `files:tree`).

6. **Migración del schema `layoutByWt`.** Layouts persistidos en Fase 6 NO tienen `viewer`. Hidratación defaultea — testeado en Task 7 con un caso explícito de "stored sin viewer".

---

## Apéndice C — Mapping tasks ↔ roadmap

| Roadmap task (7.X) | Plan task (este doc) |
|---|---|
| 7.1 `tree.ts` con ignore patterns | Task 2 |
| 7.2 `watcher.ts` con debounce | Task 5 |
| 7.3 Anotar nodos con git status | Task 4 + Task 6 (wiring) + Task 8 (`FileBadge`) |
| 7.4 Canal `files:tree` + `files:change` | Task 1 (types/channels) + Task 6 (handlers) |
| 7.5 `reader.ts` size + binary detection | Task 3 |
| 7.6 `FileTree` virtualizado | Task 8 |
| 7.7 `FileContent` con shiki | Task 9 |
| 7.8 `BinaryFilePlaceholder` | Task 9 |
| 7.9 Toggle ⌘O | Task 12 |
| 7.10 Click en tool message del chat | Task 12 |

(El plan reordena agresivamente la numeración del roadmap para reflejar las dependencias reales — los IDs `7.X` del roadmap son guía, no contrato.)
