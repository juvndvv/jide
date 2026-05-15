# Fase 8 — Command palette + atajos globales (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una **command palette unificada** abierta con `⌘K` da acceso a todo lo navegable de la app — worktrees, acciones y archivos — con fuzzy search. Todos los atajos globales viven en una **tabla declarativa única** (`keymap.ts`) que sirve simultáneamente de cableado, de fuente para la palette ("Acciones") y de fuente para el Help dialog (`?`). El refactor consolida `useSessionHotkey` (Fase 4) y unifica el patrón modal con un `<Overlay />` reutilizable que migra `NewWorktreeDialog` (Fase 2) y estrena `KillConfirmDialog` (`⌘⇧K`).

Tres entregables visibles para el usuario:

1. **Command palette (`⌘K`)** — overlay con input + lista virtual de tres grupos:
   - **Acciones**: derivado de `keymap.ts` (las entradas con `paletteLabel != null` se enumeran como ítems clickables).
   - **Worktrees**: lista plana de todos los worktrees de todos los proyectos. Click cambia el tab activo (reusa `useTabs`).
   - **Archivos**: lista del árbol de Fase 7 del worktree activo, **cap 5000 entradas**. Si supera, fallback a búsqueda lazy contra main (canal `files:search`). Click abre el archivo en el viewer (`ops.openViewer(relPath)`).
2. **Help dialog (`?`)** — overlay con la tabla completa de atajos formateada por grupos (Navegación / Edición / Layout / Sesiones). Generado desde `keymap.ts` — un solo `paletteLabel` define palette + help.
3. **Kill flow (`⌘⇧K`)** — abre `KillConfirmDialog` con detalle de la sesión activa (título, modelo, tokens). Aceptar dispara `sessions:kill`. Si no hay sesión activa en el panel con foco, no-op.

**Architecture:** Tres cambios estructurales:

- **Nuevo módulo `src/renderer/src/shortcuts/keymap.ts`** — array tipado `KeyBinding[]` con `{ id, keys, when, paletteLabel?, paletteHint?, paletteGroup?, helpGroup? }`. El array es la fuente única.
- **`useGlobalShortcuts` se refactoriza a un engine genérico** que consume el keymap, evalúa `when` contra un `ShortcutContext` (modal abierto, input con foco, sesión activa en el panel focused, etc.) y dispara el `action` registrado. Las features siguen registrando `actions` por id — pero los `keys`, `when` y la documentación viven en `keymap.ts`.
- **Nuevo primitive `<Overlay />`** en `src/renderer/src/components/dialogs/Overlay.tsx` con backdrop (`theme.scrim` + blur), focus trap, Esc handler con prioridad por z-stack, click-outside opcional. `NewWorktreeDialog`, `KillConfirmDialog`, `CommandPalette` y `HelpDialog` lo usan. El **stack de overlays** se gestiona con un context (`OverlayStackContext`) que sabe cuál está top-most para que `Esc` cierre el correcto.

**Tech Stack añadido:** `cmdk` (~7KB minified, ~3KB gzipped — accesible + fuzzy en uno, opinionated en React, integrado con React 19 sin warnings). **NO** se añade `fuse.js` (cmdk trae su propio matcher). **NO** se añade `react-focus-lock` — el focus trap es simple (~30 LOC) y vivirá dentro de `<Overlay />`.

**Tests:**
- **Unit (vitest):**
  - `keymap.test.ts` — invariantes de la tabla: ids únicos, `keys` parseable, no colisiones entre keystrokes en el mismo `when`.
  - `useGlobalShortcuts.test.tsx` — engine: dispara la acción correcta, `when` evaluado, prioridad por z-stack para Esc.
  - `Overlay.test.tsx` — backdrop click, focus trap, Esc handler, stacking.
  - `CommandPalette.test.tsx` — render de grupos, fuzzy match, navegación con flechas, Enter ejecuta.
- **E2E (Playwright):**
  - `palette.spec.ts` — ⌘K abre, escribir "billing" filtra, Enter cambia tab.
  - `shortcuts.spec.ts` — todos los atajos de `keymap.ts` con su `when` (modal abierto inhibe ⌘N pero no Esc; `?` abre help solo si no hay input focused).
  - `kill-session.spec.ts` — ⌘⇧K abre KillConfirm, Aceptar mata la sesión, status dot vuelve a idle.

**Dependencia crítica entre tasks:** Task 1 (keymap.ts + types + shortcut engine refactor) bloquea TODAS las que cablean atajos. Task 2 (Overlay primitive) bloquea las tasks de dialogs y palette. Tasks 3-4 (consolidación ⌘T + migración NewWorktreeDialog) son refactors paralelos una vez 1 y 2 están listos. Task 5 (KillConfirmDialog) y Task 6 (CommandPalette base) dependen de Task 2. Task 7 (Archivos group) depende de Task 6. Task 8 (HelpDialog) depende de Task 1 y 2. Task 9 (App wiring + ⌘⇧K) integra todo. Task 10 (E2E + audit) cierra.

---

## Decisiones cerradas (entrada al plan)

| Pregunta | Respuesta | Implicación |
|---|---|---|
| Librería de la palette | **cmdk** (Vercel). Provee `<Command>` con input, list, group, item, fuzzy matching y keyboard nav. Bundle ~7KB minified. | Sin trabajo de accesibilidad ARIA ni fuzzy a mano. cmdk respeta className → integrable con tokens del theme. |
| Modelado del keymap | **Tabla declarativa central** (`keymap.ts`). Cada entrada: `id`, `keys`, `when` (predicate evaluado contra `ShortcutContext`), `action` (registrado por feature), `paletteLabel?`, `paletteHint?`, `paletteGroup?`, `helpGroup?`. | Una sola source-of-truth para wiring, palette y help. Feature registra `action` con `useShortcutAction('palette.open', handler)`. |
| Consolidación de ⌘T | **Sí, eliminar `useSessionHotkey`**. `⌘T` pasa a `keymap.ts` con `when: 'chatFocused && !sessionCapReached'`. `ChatPanel` recibe `onNewSession` como callback registrado vía `useShortcutAction('session.new', ...)` cuando es el panel con foco. | Single source of truth. El test de Fase 4 que valida ⌘T se actualiza para verificar el dispatch via engine, no via listener local. |
| NewWorktreeDialog | **Refactor a `<Overlay />`**. Mover backdrop/scrim/focus-trap al primitive; el componente queda solo con el contenido del form. KillConfirmDialog estrena el mismo patrón. | Consistencia visual; un solo `Esc` handler stack-aware; tokens unificados. |
| Trigger del Help dialog | **`?` (sin meta)** con `when: '!inputFocused && !modal'`. El predicate inputFocused se cumple si `document.activeElement` es `INPUT/TEXTAREA/[contenteditable]`. | Tecla `?` queda libre dentro del composer (el predicate la deja pasar como carácter normal). |
| `⌘⇧K` (Kill session) | **Hotkey directo → `KillConfirmDialog`** con detalle de la sesión activa del panel focused. `when: 'sessionActive'`. También accesible como acción de la palette ("Kill active session"). Si `!sessionActive` → no-op (sin toast en v1). | El dialog confirma con título, modelo, mensaje de warning. Acepta → llama `window.jide.sessions.kill(...)`. |
| ⌘K cuando hay modal | **Siempre abre la palette encima**, gestionado por z-stack del `OverlayStackContext`. La palette tiene `z=200`; los dialogs `z=100`. `Esc` cierra siempre el top-most. | Permite saltar de un dialog a otra acción sin cerrarlo a mano. UX coherente con VS Code. |
| Fuente del grupo "Archivos" | **Árbol del file watcher de Fase 7** (`useFileTree`). Aplanado y cap a **5000 entradas**. Si supera, la palette muestra un placeholder "muchos archivos — escribe para buscar" y dispara `files:search` en main (debounce 150ms, query ≥2 chars). | Reusa la infra del watcher sin duplicar. El cap evita freezes con monorepos enormes. `files:search` es un canal nuevo de Task 7. |
| Fuzzy search | **Insensible a mayúsculas y acentos**, default de cmdk + un `normalize` propio (NFD + strip diacritics) sobre `value` y `keywords` de cada item. | El normalize está en `palette/normalize.ts`, testeado unit. cmdk acepta `filter` custom — lo usamos. |
| Persistencia de selección palette | **No persiste.** Cada apertura empieza con input vacío y el primer item de la primera lista enfocado. | Simpler; el comportamiento de "recientes" llega cuando haya demanda. |
| Numbered tabs (⌘1..⌘9) | **Fuera de scope.** No están en el mock ni en la DoD. Si se añaden, irán en backlog post-1.0. | — |
| Localización del Help dialog | **UI en español, ids en inglés.** `paletteLabel`/`paletteHint` son strings traducibles (todos en español en v1). `id` y `keys` son técnicos. | No se introduce i18n full; los strings van inline en `keymap.ts`. |
| Tokens visuales palette | **`theme.panelBg`** para el contenedor, **`theme.muted2`** para hints y group headings, **`accent.value`** para el item enfocado (con `#FFFFFF` como `color`). Sin scrim sólido — `backdrop-filter: blur(8px)` + `theme.scrim`. | Mismas reglas que el resto del shell. cmdk respeta `data-selected` para estilar el ítem activo. |

---

## File structure (final, end-of-phase)

```
jide/
├── package.json                                # +deps: cmdk
├── pnpm-lock.yaml                              # actualizado
├── src/
│   ├── shared/
│   │   └── ipc.ts                              # +channel files:search
│   ├── main/
│   │   └── ipc/
│   │       └── files.ts                        # +handler files:search (recursive walk con cap)
│   ├── preload/
│   │   └── index.ts                            # +window.jide.files.search
│   └── renderer/src/
│       ├── App.tsx                             # CHANGED: registrar shortcut actions con useShortcutAction; renderizar <CommandPalette> y <HelpDialog> en el árbol; quitar wiring ad-hoc de ⌘N/⌘O/⌘\/⌘,/Esc
│       ├── shortcuts/
│       │   ├── keymap.ts                       # NEW: KeyBinding[] declarativo + tipos
│       │   ├── useGlobalShortcuts.ts           # REWRITTEN: engine genérico que consume keymap.ts
│       │   ├── useShortcutAction.ts            # NEW: hook para que features registren su action por id
│       │   ├── ShortcutContext.tsx             # NEW: provider con { modalOpen, inputFocused, chatFocused, sessionActive, ... }
│       │   └── matchKeys.ts                    # NEW: parser de strings tipo 'meta+shift+k' + predicate sobre KeyboardEvent
│       ├── overlay/
│       │   ├── Overlay.tsx                     # NEW: primitive — backdrop, focus trap, Esc, stack-aware
│       │   ├── OverlayStackContext.tsx         # NEW: provider que ordena overlays por z y enruta Esc al top-most
│       │   └── useFocusTrap.ts                 # NEW: focus trap simple (Tab cycling) ~30 LOC
│       └── components/
│           ├── CommandPalette/
│           │   ├── CommandPalette.tsx          # NEW: <Command> de cmdk, grupos dinámicos
│           │   ├── PaletteActionsGroup.tsx     # NEW: items derivados de keymap.ts filter paletteLabel
│           │   ├── PaletteWorktreesGroup.tsx   # NEW: items derivados de useAllWorktrees
│           │   ├── PaletteFilesGroup.tsx       # NEW: items del árbol (cap 5000) o lazy search
│           │   ├── normalize.ts                # NEW: NFD + strip diacritics + lowercase
│           │   └── usePaletteOpen.ts           # NEW: estado open/close registrado en OverlayStackContext
│           ├── dialogs/
│           │   ├── NewWorktreeDialog.tsx       # CHANGED: usa <Overlay /> en vez de backdrop propio
│           │   ├── KillConfirmDialog.tsx       # NEW: usa <Overlay /> + form de confirmación
│           │   └── HelpDialog.tsx              # NEW: render por grupos del keymap.ts
│           └── Chat/
│               ├── ChatPanel.tsx               # CHANGED: registra session.new action vía useShortcutAction; quita import de useSessionHotkey
│               └── useSessionHotkey.ts         # DELETED
└── tests/
    ├── unit/
    │   ├── shortcuts/
    │   │   ├── keymap.test.ts                  # NEW: invariantes (ids únicos, no colisiones)
    │   │   ├── matchKeys.test.ts               # NEW: parser + predicate
    │   │   └── useGlobalShortcuts.test.tsx     # NEW: dispatch correcto, when, stacking de Esc
    │   ├── overlay/
    │   │   └── Overlay.test.tsx                # NEW: backdrop, Esc top-most, focus trap
    │   └── renderer/
    │       └── CommandPalette/
    │           ├── normalize.test.ts           # NEW: acentos
    │           └── CommandPalette.test.tsx     # NEW: render grupos, fuzzy, kbd nav
    └── e2e/
        ├── palette.spec.ts                     # NEW
        ├── shortcuts.spec.ts                   # NEW
        └── kill-session.spec.ts                # NEW
```

**Responsabilidades clave:**

- `shortcuts/keymap.ts` — única tabla. Cada `KeyBinding` describe **qué tecla**, **cuándo aplica**, **qué id ejecutar**, **cómo se muestra en palette y help**. No contiene lógica.
- `shortcuts/useGlobalShortcuts.ts` — engine. Único `keydown` listener global; itera `keymap`, evalúa `when(ctx)`, dispara el handler registrado por id. Ningún feature toca `window.addEventListener` nunca más.
- `shortcuts/useShortcutAction.ts` — hook que un componente usa para decir "yo soy el handler de la acción `palette.open`". Internamente registra/desregistra en un store compartido (Map<id, handler>).
- `shortcuts/ShortcutContext.tsx` — provider que mantiene el `ShortcutContext` reactivo: `modalOpen` (derivado del stack del overlay), `inputFocused` (escucha `focusin`/`focusout`), `chatFocused` (controlado por el panel activo), `sessionActive` (derivado del worktree+pane activo).
- `overlay/Overlay.tsx` — primitive. Renderiza `createPortal` a `document.body`. Registra su z en `OverlayStackContext` al montar; lo deregistra al desmontar. Tab cycling local. Esc handler local que sólo dispara si el `OverlayStackContext` dice "tú eres el top".
- `overlay/OverlayStackContext.tsx` — provider con array ordenado de `{ id, z, onEsc }`. Permite saber `topId` reactivamente. `ShortcutContext.modalOpen = stack.length > 0`.
- `CommandPalette/CommandPalette.tsx` — usa `<Command>` de cmdk con `shouldFilter={false}` (filtramos nosotros con `normalize`) y `value`/`onValueChange` controlados. Renderiza los tres grupos en orden Acciones → Worktrees → Archivos.
- `CommandPalette/PaletteFilesGroup.tsx` — lee del file tree de Fase 7 mediante `useFileTree(activeWorktreeId)`. Aplana lazy hasta 5000 entradas; si supera, usa `files:search` IPC con debounce 150ms.
- `dialogs/KillConfirmDialog.tsx` — recibe `session: SessionSnapshot` y `onCancel/onConfirm`. Render: título sesión, modelo, mensaje de warning, dos botones (Cancelar / Matar). Enter en el dialog confirma; Esc cancela (lo gestiona `<Overlay />`).
- `dialogs/HelpDialog.tsx` — agrupa entradas de `keymap.ts` por `helpGroup`. Render: nombre del grupo + tabla `[teclas | label | hint]`. Las teclas se formatean con `<Kbd>` que ya existe en Sidebar (componente reusado).

---

## Conventional Commits — recordatorio

Mismo estándar del repo (ver `~/.claude/CLAUDE.md`):

```
type(scope): short description in imperative mood

Optional body explaining the why (English).

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
```

No `Co-Authored-By`. No `Task:` trailer (rama `feat/fase-8-command-palette` no tiene ID Asana). Scopes sugeridos: `shortcuts`, `palette`, `overlay`, `dialogs`, `chat`, `ipc`.

Rama de la fase: `feat/fase-8-command-palette` desde `main`.

---

## Task 1: Shared types + keymap.ts + shortcut engine refactor

**Files:**
- Create: `src/renderer/src/shortcuts/keymap.ts`
- Create: `src/renderer/src/shortcuts/matchKeys.ts`
- Create: `src/renderer/src/shortcuts/useShortcutAction.ts`
- Create: `src/renderer/src/shortcuts/ShortcutContext.tsx`
- Rewrite: `src/renderer/src/shortcuts/useGlobalShortcuts.ts`
- Create: `tests/unit/shortcuts/keymap.test.ts`
- Create: `tests/unit/shortcuts/matchKeys.test.ts`
- Create: `tests/unit/shortcuts/useGlobalShortcuts.test.tsx`

### Step 1.1 — `matchKeys.ts`

Parser de strings tipo `'meta+shift+k'` → predicate sobre `KeyboardEvent`. Tokens:

```ts
export type KeyToken = 'meta' | 'shift' | 'alt' | 'ctrl' | string;

export interface ParsedKey {
  mods: { meta: boolean; shift: boolean; alt: boolean; ctrl: boolean };
  key: string; // lowercased
}

export function parseKeys(s: string): ParsedKey { /* split '+', lowercase, separa mods */ }

export function matchKey(parsed: ParsedKey, e: KeyboardEvent): boolean {
  const meta = e.metaKey === parsed.mods.meta || (parsed.mods.meta && e.ctrlKey); // cross-platform: cmd on mac, ctrl on win/linux
  // ... resto
}
```

Tratamiento cross-platform: `'meta+x'` matchea `metaKey` en macOS y `ctrlKey` en Win/Linux (basado en `navigator.platform`). Para `'ctrl+x'` literal usar `'ctrl+x'` explícitamente — no es el caso de ningún atajo en Fase 8.

**Tests:**
- `parseKeys('meta+shift+k')` → `{ mods: { meta: true, shift: true, alt: false, ctrl: false }, key: 'k' }`.
- `parseKeys('?')` → `{ mods: { ... false }, key: '?' }`.
- `matchKey` con `KeyboardEvent` sintético en macOS (metaKey=true) y Windows (ctrlKey=true) para el mismo `'meta+k'`.
- Inhibición: `shift+1` (que produce `!` o `1` según layout) — el matcher mira `e.key` después de modifiers, no `code`.

### Step 1.2 — `keymap.ts`

```ts
import type { ShortcutContext } from './ShortcutContext';

export type ShortcutId =
  | 'palette.open'
  | 'help.open'
  | 'overlay.close'
  | 'worktree.new'
  | 'tweaks.toggle'
  | 'terminal.toggle'
  | 'viewer.toggle'
  | 'session.new'
  | 'session.kill';

export type WhenPredicate = (ctx: ShortcutContext) => boolean;

export interface KeyBinding {
  id: ShortcutId;
  keys: string;
  when: WhenPredicate;
  paletteLabel?: string;
  paletteHint?: string;
  paletteGroup?: 'navigation' | 'actions' | 'layout' | 'sessions';
  helpGroup?: 'Navegación' | 'Layout' | 'Sesiones' | 'Otros';
}

const ALWAYS: WhenPredicate = () => true;
const NOT_MODAL: WhenPredicate = (ctx) => !ctx.modalOpen;
const ONLY_MODAL: WhenPredicate = (ctx) => ctx.modalOpen;
const TYPING: WhenPredicate = (ctx) => ctx.inputFocused;
const HELP_OK: WhenPredicate = (ctx) => !ctx.inputFocused && !ctx.modalOpen;

export const keymap: KeyBinding[] = [
  {
    id: 'palette.open',
    keys: 'meta+k',
    when: ALWAYS,
    paletteLabel: 'Abrir command palette',
    paletteGroup: 'navigation',
    helpGroup: 'Navegación',
  },
  {
    id: 'overlay.close',
    keys: 'escape',
    when: ONLY_MODAL,
    helpGroup: 'Navegación',
  },
  {
    id: 'worktree.new',
    keys: 'meta+n',
    when: NOT_MODAL,
    paletteLabel: 'Nuevo worktree…',
    paletteHint: 'Crea un worktree en el proyecto activo',
    paletteGroup: 'actions',
    helpGroup: 'Otros',
  },
  {
    id: 'tweaks.toggle',
    keys: 'meta+,',
    when: NOT_MODAL,
    paletteLabel: 'Tweaks (theme, density, accent)',
    paletteGroup: 'layout',
    helpGroup: 'Layout',
  },
  {
    id: 'terminal.toggle',
    keys: 'meta+\\',
    when: NOT_MODAL,
    paletteLabel: 'Ciclar terminal',
    paletteHint: 'Off → bottom → side',
    paletteGroup: 'layout',
    helpGroup: 'Layout',
  },
  {
    id: 'viewer.toggle',
    keys: 'meta+o',
    when: NOT_MODAL,
    paletteLabel: 'Toggle visor de archivos',
    paletteGroup: 'layout',
    helpGroup: 'Layout',
  },
  {
    id: 'session.new',
    keys: 'meta+t',
    when: (ctx) => ctx.chatFocused && !ctx.sessionCapReached && !ctx.modalOpen,
    paletteLabel: 'Nueva sesión en worktree activo',
    paletteGroup: 'sessions',
    helpGroup: 'Sesiones',
  },
  {
    id: 'session.kill',
    keys: 'meta+shift+k',
    when: (ctx) => ctx.sessionActive && !ctx.modalOpen,
    paletteLabel: 'Matar sesión activa',
    paletteGroup: 'sessions',
    helpGroup: 'Sesiones',
  },
  {
    id: 'help.open',
    keys: '?',
    when: HELP_OK,
    paletteLabel: 'Mostrar atajos de teclado',
    paletteGroup: 'navigation',
    helpGroup: 'Navegación',
  },
];
```

**Tests:**
- `keymap.test.ts` — `new Set(keymap.map(k => k.id)).size === keymap.length` (ids únicos).
- No-collision: para cada par `(a, b)` con `a.keys === b.keys`, verificar que `a.when` y `b.when` son mutuamente excluyentes en al menos un caso del `ShortcutContext` posible (smoke-test contra 4 contextos representativos: vacío / sólo modal / sólo input / sólo chat+session).
- Cada entrada con `paletteLabel` define `paletteGroup`; cada entrada con `paletteGroup` define `paletteLabel`.

### Step 1.3 — `ShortcutContext.tsx`

Provider que expone el contexto reactivo:

```ts
export interface ShortcutContext {
  modalOpen: boolean;
  inputFocused: boolean;
  chatFocused: boolean;
  sessionActive: boolean;
  sessionCapReached: boolean;
}
```

- `modalOpen` viene del `OverlayStackContext` (Task 2) — Task 1 deja un default `false` mientras Task 2 aún no existe.
- `inputFocused` se calcula con `focusin`/`focusout` sobre `document.body`: `target.tagName in {'INPUT', 'TEXTAREA'}` o `target.isContentEditable`.
- `chatFocused` se actualiza imperativamente: `ChatPanel` llama a `setChatFocused(true)` en `onFocus` y `false` en `onBlur` (delegado al wrapper).
- `sessionActive` y `sessionCapReached` se setean por `ChatPanel` cuando hay un panel activo con sesión.

El provider expone también un `dispatcher`: `register(id, handler) → unregister`. Internamente mantiene `Map<ShortcutId, () => void>`.

### Step 1.4 — `useShortcutAction.ts`

```ts
export function useShortcutAction(id: ShortcutId, handler: () => void, enabled = true): void {
  const ctx = useContext(ShortcutDispatcherContext);
  useEffect(() => {
    if (!enabled) return;
    return ctx.register(id, handler);
  }, [ctx, id, handler, enabled]);
}
```

### Step 1.5 — `useGlobalShortcuts.ts` (rewrite)

```ts
export function useGlobalShortcuts(): void {
  const ctx = useContext(ShortcutContextStateContext);
  const dispatcher = useContext(ShortcutDispatcherContext);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      for (const binding of keymap) {
        if (!binding.when(ctx)) continue;
        if (!matchKey(parseKeys(binding.keys), e)) continue;
        e.preventDefault();
        dispatcher.dispatch(binding.id);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ctx, dispatcher]);
}
```

Optimización: pre-parsear todo el keymap a `[ParsedKey, KeyBinding][]` fuera del effect (al cargar el módulo).

**Tests `useGlobalShortcuts.test.tsx`:**
- Render harness con `ShortcutContextStateContext` y `ShortcutDispatcherContext` mock.
- Dispatchear keydown `meta+k` con `modalOpen=false` → `dispatcher.dispatch('palette.open')` llamado.
- Mismo keydown con `modalOpen=true` → también dispatch (es `ALWAYS`).
- `meta+n` con `modalOpen=true` → NO dispatch (es `NOT_MODAL`).
- `escape` con `modalOpen=false` → NO dispatch.
- `escape` con `modalOpen=true` → dispatch `overlay.close`.
- `?` con `inputFocused=true` → NO dispatch.

### Step 1.6 — Migración mínima sin romper

Mientras Tasks 2-9 aterrizan, **mantener el viejo `useGlobalShortcuts` callable como wrapper** que internamente registra los handlers via `useShortcutAction`. Esto permite que `App.tsx` siga funcionando entre Task 1 y Task 9 sin un big-bang. Eliminar el wrapper en Task 9.

Concretamente: la firma vieja `useGlobalShortcuts({ onToggleTweaks, onNewWorktree, onEscape, onToggleTerminal, onToggleViewer })` se exporta también como `useLegacyGlobalShortcuts` que, dado el objeto, registra cada handler con el `id` correspondiente. `App.tsx` no cambia en Task 1.

**Definition of Done Task 1:**
- [ ] `keymap.ts` completo con las 9 bindings.
- [ ] `ShortcutContext` y `useShortcutAction` exportados.
- [ ] `useGlobalShortcuts` engine corriendo en `App.tsx` (vía wrapper legacy).
- [ ] `pnpm typecheck` verde.
- [ ] Unit tests pasan.

---

## Task 2: `<Overlay />` primitive + stack context

**Files:**
- Create: `src/renderer/src/overlay/Overlay.tsx`
- Create: `src/renderer/src/overlay/OverlayStackContext.tsx`
- Create: `src/renderer/src/overlay/useFocusTrap.ts`
- Modify: `src/renderer/src/App.tsx` — añadir `<OverlayStackProvider>` arriba del árbol; conectar `stack.length > 0` al `modalOpen` del `ShortcutContext`.
- Create: `tests/unit/overlay/Overlay.test.tsx`

### Step 2.1 — `OverlayStackContext.tsx`

```ts
interface StackEntry { id: string; z: number; onEsc: () => void }

export interface OverlayStack {
  push: (entry: StackEntry) => void;
  remove: (id: string) => void;
  topId: () => string | null;
  size: () => number;
}
```

Provider mantiene `entries: StackEntry[]` en `useState`. Expone `useOverlayStack()` para consumirlo y `useIsTopOverlay(id)` que devuelve `topId() === id` reactivamente.

`OverlayStackContext` también expone un `modalOpen` derivado: `entries.length > 0`. `ShortcutContext` lo consume.

### Step 2.2 — `useFocusTrap.ts`

```ts
export function useFocusTrap(rootRef: RefObject<HTMLElement>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const focusables = () => Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    // Focus first focusable on mount.
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [rootRef]);
}
```

### Step 2.3 — `Overlay.tsx`

```tsx
interface OverlayProps {
  id: string;
  z?: number;
  onClose: () => void;
  /** When true (default), clicks on the backdrop close the overlay. */
  closeOnBackdrop?: boolean;
  /** Aria label for screen readers. */
  ariaLabel: string;
  children: ReactNode;
}

export function Overlay({ id, z = 100, onClose, closeOnBackdrop = true, ariaLabel, children }: OverlayProps): JSX.Element {
  const stack = useOverlayStack();
  const isTop = useIsTopOverlay(id);
  const rootRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    stack.push({ id, z, onEsc: onClose });
    return () => stack.remove(id);
  }, [id, z, onClose, stack]);

  // Note: Esc se enruta desde el shortcut engine vía 'overlay.close' al top-most.
  // El binding 'overlay.close' del keymap llama al onEsc del top de la pila.

  useFocusTrap(rootRef);

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-label={ariaLabel}
      data-overlay-id={id}
      data-is-top={isTop}
      style={{
        position: 'fixed', inset: 0, zIndex: z,
        background: theme.scrim, backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>,
    document.body
  );
}
```

El handler `overlay.close` registrado en `App.tsx` itera el stack y llama al `onEsc` del top:

```ts
useShortcutAction('overlay.close', () => {
  const top = stack.entries.at(-1);
  top?.onEsc();
});
```

### Step 2.4 — Conectar al `ShortcutContext`

`ShortcutContextProvider` lee `useOverlayStack().size()` y lo expone como `modalOpen: size > 0`.

**Tests:**
- Render `<Overlay id="a">…</Overlay>` → stack tiene 1 entrada, `modalOpen=true`.
- Click en backdrop → `onClose` llamado.
- Click en el contenido → `onClose` NO llamado.
- Mount `<Overlay id="a" z=100>` + `<Overlay id="b" z=200>` → `topId === 'b'`. `Esc` (vía dispatcher) llama solo a `b.onEsc`.
- Tab cycling: 3 botones dentro del overlay, Tab desde el último vuelve al primero; Shift+Tab desde el primero va al último.

**Definition of Done Task 2:**
- [ ] `<Overlay />` renderiza por portal con backdrop blur.
- [ ] Stack ordenado por z con `topId` reactivo.
- [ ] `Esc` cierra siempre el top-most.
- [ ] Focus trap funciona y devuelve foco al elemento previo al cerrar.
- [ ] `ShortcutContext.modalOpen` se actualiza con `stack.size`.

---

## Task 3: Consolidar ⌘T — eliminar `useSessionHotkey`

**Files:**
- Modify: `src/renderer/src/components/Chat/ChatPanel.tsx` — quita `useSessionHotkey`, usa `useShortcutAction('session.new', handler, isFocused)`.
- Modify: `src/renderer/src/components/Chat/ChatPane.tsx` o equivalente — propaga `chatFocused` al `ShortcutContext` (`onFocus`/`onBlur` del wrapper del panel).
- Delete: `src/renderer/src/components/Chat/useSessionHotkey.ts`.
- Modify: tests existentes que importen `useSessionHotkey` — re-cablear vía `useShortcutAction`.

### Step 3.1 — Identificar el panel "focused"

Hoy ChatPane no tiene noción de focus a nivel del árbol de paneles. Hay que añadirla:

- `ChatPane` (la hoja con la sesión) trackea `isFocused` propio (state local) — true cuando es el activeChild del `WorktreeLayout.activePaneId` actual.
- El `WorktreeView` propaga el `activePaneId` y cada `ChatPane` compara su `paneId` con el activo.
- Cuando `isFocused=true`, el componente llama a `setChatFocused(true)` del `ShortcutContext` (vía `useEffect`); cuando deja de serlo, `setChatFocused(false)`.

Para el caso de múltiples worktrees abiertos: solo el panel del **worktree del tab activo** que también es el `activePaneId` del layout de ese worktree dispara `setChatFocused(true)`. Esto se garantiza porque solo ese `ChatPane` se monta como activo (los demás están en otros tabs y por tanto unmounted).

### Step 3.2 — Registrar la acción

```tsx
// ChatPanel.tsx (la hoja con sesión)
const canCreate = sessionsList.length < MAX_SESSIONS_PER_WORKTREE;
useShortcutAction('session.new', () => { void createSession(); }, canCreate && isFocused);

// El `when` del keymap (chatFocused && !sessionCapReached) lo evalúa el engine;
// nosotros sólo registramos el handler cuando estamos en condiciones de ejecutarlo.
// El `enabled` del hook evita registrar handlers obsoletos.
```

Aquí hay un solapamiento entre `when` (del keymap, evaluado contra el `ShortcutContext` global) y `enabled` (del registro local). El `enabled` se usa solo para limpiar el handler cuando la cap se alcanza o cuando el panel pierde foco. Es defense-in-depth.

### Step 3.3 — Eliminar `useSessionHotkey`

Borrar el archivo. Borrar la importación en `ChatPanel`. Borrar tests específicos del viejo hook.

**Tests:**
- Modificar `chat-panel.test.tsx` (o equivalente) para verificar que cuando el ChatPanel está montado y enfocado, registrar `session.new` y dispatchear `meta+t` ejecuta `createSession`.
- Cuando `isFocused=false`, dispatch no ejecuta (porque el handler no está registrado).

**Definition of Done Task 3:**
- [ ] `useSessionHotkey.ts` eliminado.
- [ ] ⌘T sigue funcionando en chat focused (e2e).
- [ ] ⌘T es no-op cuando hay un dialog abierto (porque `chatFocused` queda enmascarado por `!modalOpen`).
- [ ] `pnpm typecheck` verde, no quedan referencias a `useSessionHotkey`.

---

## Task 4: Migrar `NewWorktreeDialog` a `<Overlay />`

**Files:**
- Modify: `src/renderer/src/components/dialogs/NewWorktreeDialog.tsx`
- Modify: `src/renderer/src/App.tsx` — el id "new-worktree" del overlay y el `onClose` ya viven en App.

### Step 4.1 — Quitar el wrapper propio

Reemplazar el `<div role="dialog" style={{ position: 'fixed', inset: 0, … }}>` que rodea el form por:

```tsx
return (
  <Overlay id="new-worktree" z={100} onClose={onCancel} ariaLabel="Nuevo worktree">
    <div style={{ width: 480, background: theme.panelBg, borderRadius: 10, padding: 20, boxShadow: theme.modalShadow }}>
      {/* form actual, igual */}
    </div>
  </Overlay>
);
```

Quitar `onClick={onCancel}` del backdrop y `onClick={(e) => e.stopPropagation()}` del contenido — `<Overlay />` lo maneja.

### Step 4.2 — Preservar tests existentes

El selector `data-testid="new-worktree-dialog"` sigue presente. Mover el testid al contenedor interior si los tests lo necesitan, o exponerlo en `<Overlay />` vía prop `dataTestId`.

**Definition of Done Task 4:**
- [ ] Visualmente idéntico al estado pre-Task 4.
- [ ] Esc cierra el dialog (vía engine, no listener local).
- [ ] Click en backdrop cancela.
- [ ] Tab cycling funciona dentro del form.
- [ ] Tests existentes pasan sin cambios mayores.

---

## Task 5: `KillConfirmDialog`

**Files:**
- Create: `src/renderer/src/components/dialogs/KillConfirmDialog.tsx`
- Modify: `src/renderer/src/App.tsx` — estado `killTarget: { worktreeId, session } | null`, render del dialog, registro de `session.kill` action.
- Create: `tests/e2e/kill-session.spec.ts` (test de E2E va en Task 10; aquí va un unit smoke test).

### Step 5.1 — Componente

```tsx
interface KillConfirmDialogProps {
  worktreeId: string;
  session: SessionSnapshot;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function KillConfirmDialog({ worktreeId, session, onCancel, onConfirm }: KillConfirmDialogProps): JSX.Element {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  };
  return (
    <Overlay id="kill-confirm" z={100} onClose={busy ? () => {} : onCancel} ariaLabel="Confirmar matar sesión">
      <div style={{ width: 420, padding: 20, background: theme.panelBg, borderRadius: 10, boxShadow: theme.modalShadow }}>
        <h2 style={{ margin: 0, fontSize: 18, marginBottom: 8 }}>Matar sesión</h2>
        <p style={{ margin: '0 0 12px 0', color: theme.muted2 }}>
          Vas a matar <strong>{session.title ?? `Sesión ${session.id.slice(0, 6)}`}</strong>
          {session.model ? <> · {session.model}</> : null}.
        </p>
        <p style={{ margin: '0 0 16px 0', color: theme.muted2, fontSize: 12 }}>
          El proceso terminará inmediatamente. La conversación se mantiene en el historial.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button
            type="button"
            data-testid="kill-confirm-submit"
            onClick={() => void handle()}
            disabled={busy}
            autoFocus
            style={{ background: theme.error, color: '#FFFFFF', border: 'none', padding: '6px 12px', borderRadius: 6 }}
          >
            {busy ? 'Matando…' : 'Matar'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
```

### Step 5.2 — Wiring en `App.tsx`

```tsx
const [killTarget, setKillTarget] = useState<{ worktreeId: string; session: SessionSnapshot } | null>(null);

useShortcutAction('session.kill', () => {
  const wt = activeWorktreeId;
  if (!wt) return;
  const session = activeSessionForWorktree(wt); // del SessionManager state del renderer
  if (!session) return;
  setKillTarget({ worktreeId: wt, session });
});

// ...
{killTarget && (
  <KillConfirmDialog
    worktreeId={killTarget.worktreeId}
    session={killTarget.session}
    onCancel={() => setKillTarget(null)}
    onConfirm={async () => {
      await window.jide.sessions.kill(killTarget.worktreeId, killTarget.session.id);
      setKillTarget(null);
    }}
  />
)}
```

**Definition of Done Task 5:**
- [ ] ⌘⇧K con sesión activa abre el dialog con el detalle correcto.
- [ ] Matar dispara `sessions:kill`; sin sesión activa la hotkey es no-op.
- [ ] Cancelar / Esc / click-outside cierran.
- [ ] Estado `busy` previene doble-click.

---

## Task 6: `CommandPalette` base + grupos Acciones + Worktrees

**Files:**
- Install: `pnpm add cmdk`.
- Create: `src/renderer/src/components/CommandPalette/CommandPalette.tsx`
- Create: `src/renderer/src/components/CommandPalette/PaletteActionsGroup.tsx`
- Create: `src/renderer/src/components/CommandPalette/PaletteWorktreesGroup.tsx`
- Create: `src/renderer/src/components/CommandPalette/normalize.ts`
- Create: `src/renderer/src/components/CommandPalette/usePaletteOpen.ts`
- Modify: `src/renderer/src/App.tsx` — registrar `palette.open` action, render `<CommandPalette />`.

### Step 6.1 — Instalar cmdk

```bash
pnpm add cmdk
```

cmdk peer deps: react ≥18. Compatible con React 19 sin warnings (verificado en su changelog ≥1.0).

### Step 6.2 — `normalize.ts`

```ts
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
```

Tests: `normalize('Cámara') === 'camara'`. `normalize('São Paulo') === 'sao paulo'`.

### Step 6.3 — `usePaletteOpen.ts`

```ts
export function usePaletteOpen(): { open: boolean; setOpen: (v: boolean) => void } {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
```

Simple por ahora; en Task 6.4 el componente lo conecta con `palette.open` action.

### Step 6.4 — `CommandPalette.tsx`

```tsx
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element | null {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  if (!open) return null;
  return (
    <Overlay id="palette" z={200} onClose={onClose} ariaLabel="Command palette">
      <div style={{ width: 560, maxHeight: '70vh', background: theme.panelBg, borderRadius: 10, boxShadow: theme.modalShadow, overflow: 'hidden' }}>
        <Command
          shouldFilter={false}
          filter={(value, search, keywords) => {
            // We do our own normalize-based filter; cmdk only renders order.
            const haystack = normalize([value, ...(keywords ?? [])].join(' '));
            return haystack.includes(normalize(search)) ? 1 : 0;
          }}
        >
          <Command.Input value={query} onValueChange={setQuery} placeholder="Buscar acciones, worktrees, archivos…" autoFocus
            style={{ width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', outline: 'none', color: theme.fg, fontSize: 15 }} />
          <Command.List style={{ maxHeight: 420, overflow: 'auto', padding: 8 }}>
            <Command.Empty style={{ padding: 12, color: theme.muted2 }}>Sin resultados.</Command.Empty>
            <PaletteActionsGroup query={query} onSelect={onClose} />
            <PaletteWorktreesGroup query={query} onSelect={onClose} />
            {/* PaletteFilesGroup llega en Task 7 */}
          </Command.List>
        </Command>
      </div>
    </Overlay>
  );
}
```

### Step 6.5 — `PaletteActionsGroup.tsx`

```tsx
export function PaletteActionsGroup({ query, onSelect }: { query: string; onSelect: () => void }): JSX.Element {
  const dispatcher = useContext(ShortcutDispatcherContext);
  const ctx = useContext(ShortcutContextStateContext);
  // Filtra entradas con paletteLabel cuyo `when` se cumple en el contexto actual.
  const items = keymap.filter(b => b.paletteLabel && b.when(ctx));
  // Si no hay query, renderiza tal cual; cmdk se encarga de fuzzy via filter.
  return (
    <Command.Group heading="Acciones">
      {items.map(b => (
        <Command.Item
          key={b.id}
          value={b.paletteLabel!}
          keywords={[b.id, b.paletteHint ?? '', b.paletteGroup ?? '']}
          onSelect={() => { dispatcher.dispatch(b.id); onSelect(); }}
        >
          <span>{b.paletteLabel}</span>
          {b.paletteHint && <span style={{ marginLeft: 8, color: 'var(--muted2)' }}>{b.paletteHint}</span>}
          <span style={{ marginLeft: 'auto' }}><Kbd>{b.keys}</Kbd></span>
        </Command.Item>
      ))}
    </Command.Group>
  );
}
```

`<Kbd />` se reusa del Sidebar (ya existe en Fase 5).

### Step 6.6 — `PaletteWorktreesGroup.tsx`

```tsx
export function PaletteWorktreesGroup({ query, onSelect }: { query: string; onSelect: () => void }): JSX.Element {
  const { all } = useAllWorktrees(); // hook existente
  const { openTab } = useTabs();
  return (
    <Command.Group heading="Worktrees">
      {all.map(wt => (
        <Command.Item
          key={wt.id}
          value={`${wt.projectName} / ${wt.branch}`}
          keywords={[wt.path, wt.id]}
          onSelect={() => { openTab(wt.id); onSelect(); }}
        >
          <span>{wt.projectName}</span>
          <span style={{ marginLeft: 6, color: 'var(--muted2)' }}>/ {wt.branch}</span>
        </Command.Item>
      ))}
    </Command.Group>
  );
}
```

### Step 6.7 — Wiring en `App.tsx`

```tsx
const palette = usePaletteOpen();
useShortcutAction('palette.open', () => palette.setOpen(true));

// ...
<CommandPalette open={palette.open} onClose={() => palette.setOpen(false)} />
```

**Tests:**
- `CommandPalette.test.tsx` — render con `open=true`, verifica heading "Acciones" y "Worktrees".
- `normalize.test.ts` — acentos.
- E2E (en Task 10): `⌘K` → escribir "billing" → Enter cambia tab.

**Definition of Done Task 6:**
- [ ] ⌘K abre la palette desde cualquier sitio (con modal abierto debajo, pero queda encima).
- [ ] Acciones y Worktrees se filtran fuzzy con acentos.
- [ ] Seleccionar una acción dispatcha el id y cierra la palette.
- [ ] Seleccionar un worktree abre su tab y cierra la palette.

---

## Task 7: Palette — grupo Archivos (con cap y lazy search)

**Files:**
- Modify: `src/shared/ipc.ts` — add channel `files:search`.
- Modify: `src/main/ipc/files.ts` — handler `files:search`.
- Modify: `src/preload/index.ts` — exponer `window.jide.files.search`.
- Create: `src/renderer/src/components/CommandPalette/PaletteFilesGroup.tsx`
- Modify: `src/renderer/src/components/CommandPalette/CommandPalette.tsx` — incluir el grupo.

### Step 7.1 — Channel `files:search`

```ts
'files:search': {
  req: { worktreeId: string; query: string; limit: number };
  res: { relPath: string; name: string }[];
};
```

Main handler walks the same `readChildren` tree filtered by `isIgnoredPath`, but **recursively**, applying `normalize(query)` as substring filter. Hard cap at `limit` (default 100). Implementación recursive con early exit cuando se alcanza el cap.

### Step 7.2 — `PaletteFilesGroup.tsx`

```tsx
export function PaletteFilesGroup({ query, onSelect }: { query: string; onSelect: () => void }): JSX.Element | null {
  const wt = useActiveWorktree();
  const ops = useWorktreeLayout(wt?.id ?? null);
  const tree = useFileTree(wt?.id ?? null);
  const flat = useMemo(() => flattenTreeCapped(tree, 5000), [tree]);
  const tooBig = flat === null;
  const [lazy, setLazy] = useState<{ relPath: string; name: string }[]>([]);

  useEffect(() => {
    if (!tooBig || !wt || query.length < 2) { setLazy([]); return; }
    const t = setTimeout(() => {
      void window.jide.files.search(wt.id, query, 100).then(setLazy);
    }, 150);
    return () => clearTimeout(t);
  }, [tooBig, wt?.id, query]);

  const items = tooBig ? lazy : flat;
  if (!wt) return null;
  return (
    <Command.Group heading="Archivos">
      {tooBig && query.length < 2 && (
        <Command.Item disabled value="__hint__">Escribe ≥2 caracteres para buscar (repo grande)</Command.Item>
      )}
      {items.map(f => (
        <Command.Item
          key={f.relPath}
          value={f.name}
          keywords={[f.relPath]}
          onSelect={() => { ops.openViewer(f.relPath); onSelect(); }}
        >
          <span>{f.name}</span>
          <span style={{ marginLeft: 8, color: 'var(--muted2)', fontSize: 12 }}>{dirname(f.relPath)}</span>
        </Command.Item>
      ))}
    </Command.Group>
  );
}
```

`flattenTreeCapped(tree, 5000)` recorre el árbol expandido y aplanado. Devuelve `null` si llegamos al cap antes de terminar — señal de "repo grande, usa lazy".

### Step 7.3 — Tests

- Unit `flattenTreeCapped.test.ts` — caps at limit, devuelve null cuando excede.
- E2E: con repo grande de fixture (5001 archivos sintéticos), palette muestra hint y al escribir muestra resultados via `files:search`.

**Definition of Done Task 7:**
- [ ] Grupo Archivos visible cuando hay worktree activo.
- [ ] Repos pequeños (<5000 entradas): lista directa, fuzzy local.
- [ ] Repos grandes: hint + lazy search vía IPC con debounce 150ms.
- [ ] Click en archivo abre el viewer en ese path (Fase 7 wiring).

---

## Task 8: `HelpDialog`

**Files:**
- Create: `src/renderer/src/components/dialogs/HelpDialog.tsx`
- Modify: `src/renderer/src/App.tsx` — estado `helpOpen`, registrar `help.open` action, render.

```tsx
export function HelpDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const { theme } = useTheme();
  const groups = useMemo(() => {
    const byGroup = new Map<string, KeyBinding[]>();
    for (const b of keymap) {
      if (!b.helpGroup) continue;
      if (!byGroup.has(b.helpGroup)) byGroup.set(b.helpGroup, []);
      byGroup.get(b.helpGroup)!.push(b);
    }
    return Array.from(byGroup.entries());
  }, []);
  return (
    <Overlay id="help" z={120} onClose={onClose} ariaLabel="Atajos de teclado">
      <div style={{ width: 540, maxHeight: '80vh', overflow: 'auto', padding: 20, background: theme.panelBg, borderRadius: 10, boxShadow: theme.modalShadow }}>
        <h2 style={{ margin: 0, fontSize: 18, marginBottom: 12 }}>Atajos de teclado</h2>
        {groups.map(([heading, items]) => (
          <section key={heading} style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 13, color: theme.muted2, textTransform: 'uppercase', letterSpacing: 0.4 }}>{heading}</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {items.map(b => (
                  <tr key={b.id}>
                    <td style={{ padding: '4px 0', width: 140 }}><Kbd>{b.keys}</Kbd></td>
                    <td style={{ padding: '4px 0' }}>{b.paletteLabel ?? b.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </Overlay>
  );
}
```

Wiring en `App.tsx`: análogo al palette.

**Definition of Done Task 8:**
- [ ] `?` abre el dialog (con `!inputFocused && !modal`).
- [ ] Render por grupos; cada entrada con `helpGroup` aparece exactamente una vez.
- [ ] Esc / click-outside cierran.

---

## Task 9: `App.tsx` cleanup + final wiring

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Delete: residuos del wrapper legacy de `useGlobalShortcuts`.

### Step 9.1 — Quitar el wrapper legacy

`App.tsx` reemplaza el viejo `useGlobalShortcuts({ onToggleTweaks, onNewWorktree, onEscape, onToggleTerminal, onToggleViewer })` por un único `useGlobalShortcuts()` (sin args) + bloques de `useShortcutAction`:

```tsx
useShortcutAction('tweaks.toggle', () => setTweaksOpen(o => !o));
useShortcutAction('worktree.new', () => setNewWorktreeOpen(true));
useShortcutAction('terminal.toggle', () => activeOps?.cycleTerminal());
useShortcutAction('viewer.toggle', () => activeOps?.toggleViewer());
useShortcutAction('palette.open', () => palette.setOpen(true));
useShortcutAction('help.open', () => setHelpOpen(true));
useShortcutAction('session.kill', () => { /* abre KillConfirmDialog */ });
useShortcutAction('overlay.close', () => { /* dispatch al top del stack */ });
// session.new se registra en ChatPanel (Task 3).
```

### Step 9.2 — Eliminar `useLegacyGlobalShortcuts`

Si seguía existiendo desde Task 1 para no romper, ahora se elimina. Verificar que no quedan llamadas.

### Step 9.3 — Verificar coherencia visual

- StatusBar muestra el botón "Term" + "Visor" de Fase 6/7. Añadir un botón "⌘K" en la StatusBar (o en TopChromeStrip) que abre la palette. **Opcional v1** — si el mock no lo tenía, no se añade.
- `helpOpen` y `killTarget` se conectan a las acciones del keymap.

**Definition of Done Task 9:**
- [ ] `useGlobalShortcuts()` sin parámetros, todos los handlers registrados vía `useShortcutAction`.
- [ ] `useSessionHotkey` eliminado.
- [ ] No queda ningún `window.addEventListener('keydown', ...)` fuera del engine.
- [ ] `pnpm typecheck` verde (los 3 tsconfigs).
- [ ] App arranca y todos los atajos funcionan.

---

## Task 10: E2E + audit + DoD

**Files:**
- Create: `tests/e2e/palette.spec.ts`
- Create: `tests/e2e/shortcuts.spec.ts`
- Create: `tests/e2e/kill-session.spec.ts`
- Run: `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`.

### Step 10.1 — `palette.spec.ts`

- Abrir app, ⌘K → palette visible, focus en el input.
- Escribir "billing" → grupo Worktrees filtra a items matching.
- Flecha abajo → primer item enfocado.
- Enter → tab cambia al worktree seleccionado, palette cerrada.
- ⌘K otra vez → input vacío, palette de nuevo.
- Escribir "tweaks" → grupo Acciones tiene "Tweaks (theme, density, accent)".
- Enter → TweaksPanel abre, palette cerrada.
- Caso acentos: nombrar un worktree "São Paulo", escribir "sao" → match.

### Step 10.2 — `shortcuts.spec.ts`

- Recorrer cada `KeyBinding` con `paletteLabel`:
  - Setup que cumple su `when` → enviar las teclas → verificar el efecto observable.
  - Setup que NO cumple su `when` (e.g. modal abierto) → enviar teclas → verificar no-op.
- `?` con foco en composer → carácter `?` aparece en el textarea (no abre help).
- `?` con foco fuera → abre Help.

### Step 10.3 — `kill-session.spec.ts`

- Crear sesión en worktree → focus en ChatPanel.
- ⌘⇧K → KillConfirmDialog visible con título de la sesión.
- Cancelar → dialog cierra, sesión sigue corriendo.
- ⌘⇧K otra vez → Matar → status dot pasa a `idle`, sesión ya no aparece en la lista.

### Step 10.4 — Final audit (subagent reviewer)

- Pasada del `superpowers:verification-before-completion`:
  - `pnpm typecheck` (los 3 tsconfigs) verde.
  - `pnpm test` verde.
  - `pnpm test:e2e` verde.
  - Smoke manual en dev: `⌘K`, `?`, `⌘N`, `⌘O`, `⌘\`, `⌘,`, `⌘T`, `⌘⇧K`, `Esc` (con y sin modal).
  - Verificación visual: dialogs comparten estética (backdrop blur, panel bg, sombra) — sin discrepancias entre NewWorktreeDialog, KillConfirmDialog y HelpDialog.

### Step 10.5 — DoD checklist

- [ ] **Palette `⌘K`:** abre en <50ms (mide con `performance.now` en dev) desde cualquier estado, incluido con un modal abierto.
- [ ] **Grupos:** Acciones (de keymap), Worktrees (de useAllWorktrees), Archivos (de tree de Fase 7 o lazy).
- [ ] **Fuzzy:** insensible a mayúsculas y acentos en value + keywords.
- [ ] **Atajos del mock:** todos los siguientes funcionan tal cual:
  - `⌘K` → palette
  - `⌘N` → NewWorktreeDialog
  - `⌘T` → nueva sesión (chat focused, cap no alcanzada)
  - `⌘⇧K` → KillConfirmDialog
  - `⌘\` → ciclo terminal
  - `⌘O` → toggle viewer
  - `⌘,` → tweaks
  - `Esc` → cierra top-most overlay
  - `?` → help
- [ ] **Esc-stack:** con dos overlays abiertos, Esc cierra primero el top, luego el siguiente.
- [ ] **NewWorktreeDialog:** crea ramas con `git worktree add -b` (sin regresión de Fase 2).
- [ ] **HelpDialog:** una sola fuente (`keymap.ts`); cualquier nuevo binding aparece automáticamente.
- [ ] **Cero `window.addEventListener('keydown', ...)` fuera de `useGlobalShortcuts`** (grep verifica).

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| cmdk + React 19 → warnings de StrictMode | Verificar con `pnpm dev` y, si aparecen, fijar versión de cmdk a la última que soporte 19 explícitamente. |
| `?` se traga el carácter en el composer | `when: '!inputFocused'` resuelto en Task 1; tests unit verifican. |
| Focus trap pelea con el composer ya abierto en background | Cuando una overlay monta, `useFocusTrap` mueve el foco al primer focusable interior. Al desmontar, el foco vuelve al elemento previo (capturado al mount). Tests unit verifican. |
| Stack de overlays inconsistente si dos abren y cierran fuera de orden | El stack mantiene un `Map<id, entry>` y un array ordenado; remove busca por id. Test cubre el caso A→B→cerrar A→cerrar B. |
| Refactor de `useSessionHotkey` rompe la cap de sesiones (Fase 4) | Test de Fase 4 que valida cap se adapta; e2e `kill-session.spec.ts` ejercita la cap. |
| `files:search` lento en monorepos enormes (>50k archivos) | Cap a 100 resultados + early exit en main; debounce 150ms en renderer. Si sigue lento, fallback a "muestra primeros 100 sin búsqueda" en futuro. |

---

## Hand-off a Fase 9

- App está **feature-complete** del mock. Lo que sigue (Fase 9) es empaquetado, code signing, auto-update, onboarding.
- `keymap.ts` queda como la entrada natural para el panel de Preferencias > Atajos (Fase 9). Cambiar un atajo será editar la tabla.
- `<Overlay />` queda disponible para el About dialog y el Preferences dialog nativos de Fase 9.
- `files:search` queda como capacidad genérica para futuras integraciones (Cmd+P "Go to file", etc.).
