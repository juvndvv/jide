# Fase 5 — Tabs + UI shell completa (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La app se ve y se siente como el mock (`design/project/jide/`). Tokens de diseño centralizados (`light`/`dark`/`auto` + 4 acentos + 2 densidades) consumidos por todo el renderer vía un `ThemeProvider`. `TabBar` superior con tabs persistentes (worktrees abiertos) y stripe de acento en el activo. `TopChromeStrip` con traffic lights nativos + breadcrumb proyecto/branch + botón ⌘K (mock visual, palette llega en Fase 8). `StatusBar` inferior pintada con la banda de acento del tema. `TweaksPanel` (popover desde el botón "Ajustes" de la Sidebar) cambia `theme/density/accent/sidebarSide` en vivo y persiste. La Sidebar puede ir a la izquierda o derecha. Animaciones del mock (pulse para `running`, blink para cursor de streaming). Tests E2E de DOM+estilos comparan light vs dark vs cada accent y prueban el flujo de tweaks + persistencia.

**Architecture:** El cambio fundamental es introducir un **único sistema de tokens** y un **`ThemeProvider` con context** que sustituye a todo el styling hardcoded (`#F95A5C`, `#F6F4EF`, `#00000010`, etc.) que las fases anteriores fueron sembrando por componente. Cada componente lee `useTheme()` y obtiene `{ theme, accent, density, sidebarSide }`. Los keyframes de `styles.css` siguen ahí (CSS-level animations) pero su color de pulse pasa a leer `var(--jide-accent)` que el `ThemeProvider` mantiene actualizada vía un `<style>` inyectado en `:root`. Para tabs, `App.tsx` deja de manejar `activeWorktreeId` directamente y delega a un hook `useTabs()` que es la única fuente de verdad sobre `openTabs: TabRef[]` + `activeWorktreeId`, persistido en `settings.openTabs` y `settings.lastWorktreeId` (ya existía esta última pero estaba sin uso). El layout pasa de `flexDirection: 'row'` fijo a `row | row-reverse` según `sidebarSide`. El `StatusBar` consume `worktree.status` ya emitido por main (Fase 2) — no necesita IPC nuevo. El `TopChromeStrip` usa `-webkit-app-region: drag` para que el usuario pueda arrastrar la ventana desde la zona del breadcrumb, respetando la región no-draggable del botón ⌘K. `'auto'` theme observa `window.matchMedia('(prefers-color-scheme: dark)')` y resuelve a `light`/`dark` en vivo.

**Tech Stack añadido:** Nada nuevo en runtime. Solo React context (`createContext` ya viene con React) y `matchMedia` (browser API). Tests usan Playwright (ya configurado en Fase 1) + nuevo helper `themeProbe(window)` que lee `getComputedStyle` de elementos canónicos.

**Tests son deterministas y rápidos.** Las verificaciones visuales son DOM + estilos inline + `getComputedStyle`. No hay `toHaveScreenshot` ni dependencias gráficas. Una sola screenshot canon opcional documental (no enforced) por modo va a `tests/e2e/__snapshots__/` para revisión humana, pero el assert vive en estilos computados.

**Dependencia crítica:** Task 1 (tokens + types + settings schema) bloquea Tasks 2-11. Task 2 (`ThemeProvider` + `useTheme`) bloquea Tasks 3-9 (todos los componentes presentacionales). Task 10 (`useTabs` + persistencia) puede ir en paralelo con 3-9. Task 11 (`TweaksPanel`) cierra el ciclo activando los settings de Task 1. Task 12 (animaciones CSS) puede ir en cualquier momento después de Task 2. Task 13 (E2E + drift guards) es el último.

---

## Decisiones cerradas (entrada al plan)

| Pregunta | Respuesta | Implicación |
|---|---|---|
| Densidades soportadas | **`compact` + `comfy`** (mock-fidélico — el roadmap mencionaba `cozy` pero el mock no lo define). | `Density` type tiene dos miembros. `DEFAULT_SETTINGS.density = 'comfy'`. |
| Shape de tabs persistidos | **`openTabs: { worktreeId: string; projectId: string }[]`** — pares explícitos. | Robusto si la convención del id de worktree cambia (hoy `${repoRoot}:${worktreePath}`). El reload reconstruye desde proyectos cargados; tabs huérfanas (cuyo worktreeId ya no existe) se filtran silenciosamente. |
| Comportamiento de `theme: 'auto'` | **Escucha `prefers-color-scheme`** en vivo vía `matchMedia('(prefers-color-scheme: dark)').addEventListener('change', …)`. | `useTheme()` resuelve `effectiveMode: 'light' \| 'dark'`. Cambiar el SO de claro a oscuro re-renderiza la app sin reload. |
| Snapshot tests | **DOM + estilos computados** (no pixel-diff). | Helper `themeProbe(window)` lee `getComputedStyle` de selectores estables y compara contra valores esperados de tokens. Sin flakiness por fuentes/GPU. |
| TopChromeStrip drag region | **Toda la barra `drag`, traffic lights y botón ⌘K marcados `no-drag`** vía `-webkit-app-region`. | Permite mover la ventana arrastrando del breadcrumb. macOS-friendly. |
| Botón ⌘K en TopChrome | **Visual no-op** en Fase 5. Solo abre el palette cuando Fase 8 lo cablee. Hoy renderiza pero el `onClick` queda en `console.warn('palette: pending Fase 8')`. | Evita feature-flag complexity. El mock visual aparece desde ya. |
| Botón "Ajustes" de Sidebar (⌘,) | **Abre el `TweaksPanel`** como popover anclado al botón. La hotkey `⌘,` también lo abre/cierra. | El SidebarRow `Ajustes` ya existía sin `onClick`. Aquí gana el handler. |
| Migración de estilos hardcoded | **Sustitución exhaustiva** en Sidebar/Chat/Composer/UserMessage/StatusDot/etc. — todo lo que use `#F95A5C`, `#F6F4EF`, `#1F1F1F`, `#00000010/08`, etc. pasa a tokens. | Granular por componente (un commit por archivo donde tenga sentido). El `--jide-accent` de `styles.css` se mantiene como puente para las keyframes. |
| Auto-color del traffic light position | **Vertical fijo** (`{ x: 14, y: 14 }` ya está) — no cambia con la altura del chrome strip (30px). | `trafficLightPosition` se setea en `createMainWindow` (ya hecho en Fase 1). El strip se dimensiona para alojarlos. |

---

## File structure (final, end-of-phase)

```
jide/
├── src/
│   ├── main/
│   │   └── window.ts                          # sin cambios (traffic lights ya colocados)
│   ├── shared/
│   │   ├── theme.ts                           # NEW: tokens light/dark + accents + densities
│   │   └── settings.ts                        # +density, +accent, +sidebarSide, +openTabs
│   └── renderer/src/
│       ├── theme/
│       │   ├── tokens.ts                      # NEW: re-exporta shared/theme para uso renderer
│       │   ├── ThemeProvider.tsx              # NEW: context + matchMedia listener + CSS var sync
│       │   └── useTheme.ts                    # NEW: hook
│       ├── shortcuts/
│       │   ├── useTabs.ts                     # NEW: openTabs + activeWorktreeId persistidos
│       │   └── useGlobalShortcuts.ts          # NEW (mínimo Fase 5: ⌘N, ⌘,, Esc)
│       ├── components/
│       │   ├── Chrome/
│       │   │   ├── TopChromeStrip.tsx         # NEW
│       │   │   └── PaletteButton.tsx          # NEW (visual ⌘K)
│       │   ├── TabBar/
│       │   │   ├── TabBar.tsx                 # NEW
│       │   │   └── Tab.tsx                    # NEW
│       │   ├── StatusBar/
│       │   │   ├── StatusBar.tsx              # NEW
│       │   │   └── StatusItem.tsx             # NEW
│       │   ├── Tweaks/
│       │   │   ├── TweaksPanel.tsx            # NEW (popover)
│       │   │   ├── TweakSection.tsx           # NEW
│       │   │   ├── TweakRadio.tsx             # NEW
│       │   │   └── TweakColor.tsx             # NEW (accent swatches)
│       │   ├── Sidebar/
│       │   │   ├── Sidebar.tsx                # consume useTheme; +side prop; +settings button onClick
│       │   │   ├── SidebarSection.tsx         # consume useTheme
│       │   │   ├── SidebarRow.tsx             # consume useTheme + supports ref for popover anchor
│       │   │   ├── ProjectBranch.tsx          # consume useTheme
│       │   │   ├── ProjectNode.tsx            # consume useTheme + densidad para row height
│       │   │   └── WorktreeRow.tsx            # quita ACCENT hardcoded, consume useTheme
│       │   ├── Chat/
│       │   │   ├── ChatPanel.tsx              # consume useTheme
│       │   │   ├── Composer.tsx               # quita #F95A5C hardcoded
│       │   │   ├── UserMessage.tsx            # quita #F95A5C hardcoded
│       │   │   ├── ClaudeMessage.tsx          # consume useTheme
│       │   │   ├── ToolMessage.tsx            # consume useTheme
│       │   │   ├── DiffMessage.tsx            # consume useTheme (semantic diff tokens)
│       │   │   ├── SystemMessage.tsx          # consume useTheme
│       │   │   ├── ApprovalBar.tsx            # consume useTheme
│       │   │   ├── StreamingIndicator.tsx     # consume useTheme + blink keyframe usa accent
│       │   │   ├── SessionStrip.tsx           # consume useTheme
│       │   │   ├── SessionChip.tsx            # consume useTheme
│       │   │   ├── SessionMeta.tsx            # consume useTheme
│       │   │   └── EmptySessions.tsx          # consume useTheme
│       │   ├── dialogs/
│       │   │   └── NewWorktreeDialog.tsx      # consume useTheme
│       │   └── icons/
│       │       ├── JIcon.tsx                  # +icons: branch, arrow-up, arrow-down, diff, claude, cli, terminal, eye, command, split-v, split-h, settings (extendida)
│       │       ├── Kbd.tsx                    # consume useTheme
│       │       └── StatusDot.tsx              # ya usa accent indirectamente; explícito vía useTheme
│       ├── App.tsx                            # envuelve en <ThemeProvider>; delega tabs a useTabs; layout responsive a sidebarSide
│       ├── main.tsx                           # sin cambios
│       └── styles.css                         # keyframes generalizadas + reset; --jide-accent se actualiza desde ThemeProvider
└── tests/
    ├── unit/
    │   ├── shared/
    │   │   ├── theme.test.ts                  # NEW: tokens + accents + densities shape
    │   │   └── settings.test.ts               # ampliado: density/accent/sidebarSide/openTabs defaults
    │   └── renderer/
    │       └── theme.test.tsx                 # NEW: ThemeProvider context + matchMedia listener
    └── e2e/
        ├── shell.spec.ts                      # NEW: TabBar + StatusBar + TopChrome render
        ├── theme.spec.ts                      # NEW: light vs dark, accent swap, density swap
        ├── sidebar-side.spec.ts               # NEW: left/right toggle
        └── helpers/
            └── theme-probe.ts                 # NEW: getComputedStyle reader
```

**Responsabilidades clave:**

- `src/shared/theme.ts` — fuente única de tokens. Sin React. Importable desde main si se necesita en el futuro (no se necesita hoy). 4 acentos × 2 modos × 2 densidades.
- `src/renderer/src/theme/ThemeProvider.tsx` — único módulo que decide qué tokens están activos. Suscribe a `prefers-color-scheme` cuando `themeMode === 'auto'`. Sincroniza `--jide-accent` en `:root` para que las keyframes CSS sigan funcionando.
- `src/renderer/src/shortcuts/useTabs.ts` — única fuente de verdad sobre `openTabs` y `activeWorktreeId`. Persiste a `settings.openTabs` y `settings.lastWorktreeId` con debounce 200ms. Filtra tabs huérfanas al hidratar.
- `src/renderer/src/components/TabBar/TabBar.tsx` — UI presentacional. Recibe `tabs`, `activeId`, `projects`, callbacks. Sin estado propio.
- `src/renderer/src/components/Tweaks/TweaksPanel.tsx` — popover anclado al botón "Ajustes". Lee y muta vía `useTheme()` (que internamente usa `settings:set`). No conoce el origen físico (settings vs props).
- `src/renderer/src/components/StatusBar/StatusBar.tsx` — consume `useTheme()` (banda con `accent.value`), recibe `worktree` y `project` activos por props.

---

## Conventional Commits — recordatorio

Todos los commits siguen la convención del repo (ver `~/.claude/CLAUDE.md`):

```
type(scope): short description in imperative mood

Optional body explaining the why (English).

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
```

No `Co-Authored-By`. No `Task:` trailer (rama `feat/fase-5-tabs-ui-shell` no tiene ID Asana). Sugerencia de scopes: `theme`, `tabs`, `chrome`, `statusbar`, `tweaks`, `sidebar`, `chat`.

---

## Task 1: Shared tokens, settings & types

**Files:**
- Create: `src/shared/theme.ts`
- Modify: `src/shared/settings.ts`
- Create: `tests/unit/shared/theme.test.ts`
- Modify: `tests/unit/shared/settings.test.ts`

### Step 1.1: Crear `src/shared/theme.ts`

Traduce literalmente `design/project/jide/theme.jsx` a TypeScript:

```ts
// jide — design tokens (light/dark + accents + densities).
// Pure data module. No React. Importable from main if ever needed.

export interface ThemeTokens {
  // surfaces
  appBg: string;
  panelBg: string;
  panelMuted: string;
  sidebarBg: string;
  tabbarBg: string;
  inputBg: string;
  codeBg: string;
  hoverBg: string;
  selectedBg: string;
  // borders
  border: string;
  borderStrong: string;
  borderHair: string;
  // text
  text: string;
  textMed: string;
  textLow: string;
  textDisabled: string;
  // semantic
  diffAddBg: string;
  diffAddText: string;
  diffDelBg: string;
  diffDelText: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  // shadows
  cardShadow: string;
  popoverShadow: string;
  modalShadow: string;
  scrim: string;
}

export const THEME_LIGHT: ThemeTokens = {
  appBg: '#F5F2EE',
  panelBg: '#FFFFFF',
  panelMuted: '#FAFAFA',
  sidebarBg: '#F8F6F2',
  tabbarBg: '#F2EFEA',
  inputBg: '#FFFFFF',
  codeBg: '#F5F5F5',
  hoverBg: 'rgba(31,31,31,0.04)',
  selectedBg: 'rgba(31,31,31,0.07)',
  border: '#EBEBEB',
  borderStrong: '#DBDBDB',
  borderHair: '#E6E3DE',
  text: '#1F1F1F',
  textMed: '#666666',
  textLow: '#8F8F8F',
  textDisabled: '#B8B8B8',
  diffAddBg: '#ECFDF0',
  diffAddText: '#028E5C',
  diffDelBg: '#FEF3F2',
  diffDelText: '#DA3D28',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#ED5A46',
  info: '#3B82F6',
  cardShadow: '0 1px 2px rgba(31,31,31,0.04)',
  popoverShadow: '0 8px 24px rgba(31,31,31,0.12)',
  modalShadow: '0 24px 64px rgba(0,0,0,0.18)',
  scrim: 'rgba(20,18,15,0.45)',
};

export const THEME_DARK: ThemeTokens = {
  appBg: '#0D0C10',
  panelBg: '#16151A',
  panelMuted: '#1B1A1F',
  sidebarBg: '#121116',
  tabbarBg: '#0F0E12',
  inputBg: '#1F1E24',
  codeBg: '#1B1A20',
  hoverBg: 'rgba(255,255,255,0.04)',
  selectedBg: 'rgba(255,255,255,0.07)',
  border: '#26252C',
  borderStrong: '#36353E',
  borderHair: '#1F1E25',
  text: '#F0EFEC',
  textMed: '#9A9A9F',
  textLow: '#6E6E76',
  textDisabled: '#4A4A52',
  diffAddBg: 'rgba(16,185,129,0.10)',
  diffAddText: '#34D399',
  diffDelBg: 'rgba(237,90,70,0.12)',
  diffDelText: '#F08A7C',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#ED5A46',
  info: '#3B82F6',
  cardShadow: '0 1px 0 rgba(255,255,255,0.02)',
  popoverShadow: '0 8px 32px rgba(0,0,0,0.5)',
  modalShadow: '0 24px 64px rgba(0,0,0,0.6)',
  scrim: 'rgba(0,0,0,0.55)',
};

export interface AccentTokens {
  id: AccentId;
  name: string;
  value: string;
  light: string;
  bg: string;
  bgDim: string;
  darkBg: string;
}

export type AccentId = 'coral' | 'violet' | 'emerald' | 'electric';

export const ACCENTS: Record<AccentId, AccentTokens> = {
  coral:    { id: 'coral',    name: 'Coral',     value: '#F95A5C', light: '#FF7173', bg: '#FFECEC', bgDim: '#FFF5F5', darkBg: 'rgba(249,90,92,0.14)' },
  violet:   { id: 'violet',   name: 'Violeta',   value: '#7C67F7', light: '#9D8DFA', bg: '#EEEAFF', bgDim: '#F4F2FF', darkBg: 'rgba(124,103,247,0.18)' },
  emerald:  { id: 'emerald',  name: 'Esmeralda', value: '#10B981', light: '#34D399', bg: '#D1FAE5', bgDim: '#ECFDF0', darkBg: 'rgba(16,185,129,0.16)' },
  electric: { id: 'electric', name: 'Eléctrico', value: '#3B82F6', light: '#60A5FA', bg: '#DBEAFE', bgDim: '#EFF6FF', darkBg: 'rgba(59,130,246,0.18)' },
};

export interface DensityTokens {
  row: number;
  gap: number;
  pad: number;
  side: number;
  tabH: number;
  font: number;
  mono: number;
}

export type DensityId = 'compact' | 'comfy';

export const DENSITIES: Record<DensityId, DensityTokens> = {
  compact: { row: 24, gap: 4, pad: 8,  side: 244, tabH: 32, font: 12.5, mono: 12 },
  comfy:   { row: 30, gap: 6, pad: 12, side: 280, tabH: 36, font: 13.5, mono: 13 },
};

export type SidebarSide = 'left' | 'right';

export type ThemeMode = 'light' | 'dark' | 'auto';
```

> **Nota:** `ThemeMode` se exporta también desde aquí. `src/shared/settings.ts` la re-importa para no duplicar el type.

### Step 1.2: Extender `SettingsSchema`

Modificar `src/shared/settings.ts` para añadir 4 campos nuevos. Re-importar `ThemeMode` desde `theme.ts`:

```ts
import type { Project } from './project.js';
import type { PersistedSession } from './session.js';
import type { AccentId, DensityId, SidebarSide, ThemeMode } from './theme.js';

export type { ThemeMode };

export interface TabRef {
  worktreeId: string;
  projectId: string;
}

export interface SettingsSchema {
  theme: ThemeMode;
  /** 'comfy' default. */
  density: DensityId;
  /** 'coral' default. */
  accent: AccentId;
  /** 'left' default. */
  sidebarSide: SidebarSide;
  lastWorktreeId: string | null;
  /** Persisted open-tab list (in display order). Empty by default. */
  openTabs: TabRef[];
  projects: Project[];
  /** 1..16. Default 4. */
  maxSessionsPerWorktree: number;
  activeSessionByWt: Record<string, string>;
  sessions: Record<string, PersistedSession[]>;
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
};

export type SettingsKey = keyof SettingsSchema;
```

> **Compatibilidad con stores existentes:** `electron-store` rellena los campos ausentes con `defaults`. Un store generado en Fase 4 (sin `density`/`accent`/`sidebarSide`/`openTabs`) seguirá funcionando y verá los defaults nuevos. No hace falta migración.

### Step 1.3: Tests de drift `tests/unit/shared/theme.test.ts`

```ts
import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  THEME_LIGHT,
  THEME_DARK,
  ACCENTS,
  DENSITIES,
  type ThemeTokens,
  type AccentId,
  type DensityId,
  type ThemeMode,
  type SidebarSide,
} from '@shared/theme';

describe('theme tokens', () => {
  it('light and dark share the same shape', () => {
    const lightKeys = Object.keys(THEME_LIGHT).sort();
    const darkKeys = Object.keys(THEME_DARK).sort();
    expect(darkKeys).toEqual(lightKeys);
  });

  it('exposes the four canonical accents', () => {
    expect(Object.keys(ACCENTS).sort()).toEqual(['coral', 'electric', 'emerald', 'violet']);
    expectTypeOf<AccentId>().toEqualTypeOf<'coral' | 'violet' | 'emerald' | 'electric'>();
  });

  it('exposes compact and comfy densities only', () => {
    expect(Object.keys(DENSITIES).sort()).toEqual(['comfy', 'compact']);
    expectTypeOf<DensityId>().toEqualTypeOf<'compact' | 'comfy'>();
  });

  it('density tokens are numeric and positive', () => {
    for (const d of Object.values(DENSITIES)) {
      for (const v of Object.values(d)) {
        expect(typeof v).toBe('number');
        expect(v).toBeGreaterThan(0);
      }
    }
  });

  it('accent.value is a hex color', () => {
    for (const a of Object.values(ACCENTS)) {
      expect(a.value).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('ThemeMode covers the three modes', () => {
    expectTypeOf<ThemeMode>().toEqualTypeOf<'light' | 'dark' | 'auto'>();
    expectTypeOf<SidebarSide>().toEqualTypeOf<'left' | 'right'>();
  });

  it('theme tokens fully populate ThemeTokens shape', () => {
    const keys: (keyof ThemeTokens)[] = [
      'appBg', 'panelBg', 'panelMuted', 'sidebarBg', 'tabbarBg',
      'inputBg', 'codeBg', 'hoverBg', 'selectedBg',
      'border', 'borderStrong', 'borderHair',
      'text', 'textMed', 'textLow', 'textDisabled',
      'diffAddBg', 'diffAddText', 'diffDelBg', 'diffDelText',
      'success', 'warning', 'error', 'info',
      'cardShadow', 'popoverShadow', 'modalShadow', 'scrim',
    ];
    for (const k of keys) {
      expect(THEME_LIGHT[k]).toBeTruthy();
      expect(THEME_DARK[k]).toBeTruthy();
    }
  });
});
```

### Step 1.4: Ampliar `tests/unit/shared/settings.test.ts`

Añadir (no romper existentes):

```ts
it('default settings include theme tweaks fields', () => {
  expect(DEFAULT_SETTINGS.theme).toBe('auto');
  expect(DEFAULT_SETTINGS.density).toBe('comfy');
  expect(DEFAULT_SETTINGS.accent).toBe('coral');
  expect(DEFAULT_SETTINGS.sidebarSide).toBe('left');
  expect(DEFAULT_SETTINGS.openTabs).toEqual([]);
});

it('SettingsKey covers the new fields', () => {
  expectTypeOf<SettingsKey>().toMatchTypeOf<'density' | 'accent' | 'sidebarSide' | 'openTabs'>();
});
```

### Step 1.5: Verify

```bash
pnpm vitest run tests/unit/shared/theme.test.ts tests/unit/shared/settings.test.ts
```

Expected: all green. Commit as `feat(theme): add design tokens and settings schema`.

---

## Task 2: `ThemeProvider` + `useTheme` hook

**Files:**
- Create: `src/renderer/src/theme/ThemeProvider.tsx`
- Create: `src/renderer/src/theme/useTheme.ts`
- Create: `src/renderer/src/theme/tokens.ts` (re-export from `@shared/theme`)
- Modify: `src/renderer/src/main.tsx`
- Modify: `src/renderer/src/styles.css`
- Create: `tests/unit/renderer/theme.test.tsx`

### Step 2.1: `tokens.ts` re-export

```ts
// src/renderer/src/theme/tokens.ts
export * from '@shared/theme';
```

Renderer code never imports from `@shared/theme` directly — always via `./theme/tokens` or `./theme/useTheme`. Keeps the boundary explicit.

### Step 2.2: `ThemeProvider.tsx`

```tsx
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ACCENTS,
  DENSITIES,
  THEME_DARK,
  THEME_LIGHT,
  type AccentId,
  type AccentTokens,
  type DensityId,
  type DensityTokens,
  type SidebarSide,
  type ThemeMode,
  type ThemeTokens,
} from './tokens';

export interface ThemeContextValue {
  /** User-selected mode (persisted). */
  mode: ThemeMode;
  /** Resolved mode after auto. Stable for component logic. */
  effectiveMode: 'light' | 'dark';
  theme: ThemeTokens;
  accent: AccentTokens;
  density: DensityTokens;
  sidebarSide: SidebarSide;
  setMode: (mode: ThemeMode) => void;
  setAccent: (id: AccentId) => void;
  setDensity: (id: DensityId) => void;
  setSidebarSide: (side: SidebarSide) => void;
}

// Exported as `ThemeContextInternal` only to facilitate unit tests; consumers
// must use `useTheme()` from `./useTheme`.
export const ThemeContextInternal = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  /** Initial values from settings (read once at mount). */
  initial: {
    mode: ThemeMode;
    accent: AccentId;
    density: DensityId;
    sidebarSide: SidebarSide;
  };
  /** Persistence sink. Called whenever the user changes a tweak. */
  persist: {
    setMode: (mode: ThemeMode) => void;
    setAccent: (id: AccentId) => void;
    setDensity: (id: DensityId) => void;
    setSidebarSide: (side: SidebarSide) => void;
  };
}

function resolveEffectiveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children, initial, persist }: ThemeProviderProps): JSX.Element {
  const [mode, setModeState] = useState<ThemeMode>(initial.mode);
  const [accentId, setAccentState] = useState<AccentId>(initial.accent);
  const [densityId, setDensityState] = useState<DensityId>(initial.density);
  const [sidebarSide, setSidebarSideState] = useState<SidebarSide>(initial.sidebarSide);
  const [effectiveMode, setEffective] = useState<'light' | 'dark'>(() => resolveEffectiveMode(initial.mode));

  // Watch prefers-color-scheme only while mode === 'auto'.
  useEffect(() => {
    if (mode !== 'auto') {
      setEffective(mode);
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (): void => setEffective(mq.matches ? 'dark' : 'light');
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [mode]);

  // Sync accent into CSS var so keyframes (jidePulse, etc.) stay in sync.
  const accent = ACCENTS[accentId];
  useEffect(() => {
    document.documentElement.style.setProperty('--jide-accent', accent.value);
  }, [accent.value]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    persist.setMode(next);
  }, [persist]);
  const setAccent = useCallback((id: AccentId) => {
    setAccentState(id);
    persist.setAccent(id);
  }, [persist]);
  const setDensity = useCallback((id: DensityId) => {
    setDensityState(id);
    persist.setDensity(id);
  }, [persist]);
  const setSidebarSide = useCallback((side: SidebarSide) => {
    setSidebarSideState(side);
    persist.setSidebarSide(side);
  }, [persist]);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    effectiveMode,
    theme: effectiveMode === 'dark' ? THEME_DARK : THEME_LIGHT,
    accent,
    density: DENSITIES[densityId],
    sidebarSide,
    setMode,
    setAccent,
    setDensity,
    setSidebarSide,
  }), [mode, effectiveMode, accent, densityId, sidebarSide, setMode, setAccent, setDensity, setSidebarSide]);

  return <ThemeContextInternal.Provider value={value}>{children}</ThemeContextInternal.Provider>;
}
```

### Step 2.3: `useTheme.ts`

```ts
import { useContext } from 'react';
import { ThemeContextInternal, type ThemeContextValue } from './ThemeProvider';

export function useTheme(): ThemeContextValue {
  const v = useContext(ThemeContextInternal);
  if (!v) throw new Error('useTheme() must be used within <ThemeProvider>');
  return v;
}
```

### Step 2.4: Wire `ThemeProvider` in `main.tsx`

Reemplazar `main.tsx` para que envuelva `<App />` en `<ThemeProvider>` después de cargar las settings iniciales. La carga es async; mientras tanto se renderiza nada (la ventana queda con `backgroundColor` del `BrowserWindow` que ya es `#F0EEE9`, light-coherente).

```tsx
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './theme/ThemeProvider';
import type { AccentId, DensityId, SidebarSide, ThemeMode } from './theme/tokens';
import './styles.css';

interface InitialSettings {
  mode: ThemeMode;
  accent: AccentId;
  density: DensityId;
  sidebarSide: SidebarSide;
}

function Root(): JSX.Element | null {
  const [initial, setInitial] = useState<InitialSettings | null>(null);

  useEffect(() => {
    Promise.all([
      window.jide.settings.get('theme'),
      window.jide.settings.get('accent'),
      window.jide.settings.get('density'),
      window.jide.settings.get('sidebarSide'),
    ])
      .then(([mode, accent, density, sidebarSide]) => {
        setInitial({ mode, accent, density, sidebarSide });
      })
      .catch((err: unknown) => {
        console.error('[jide] settings boot failed', err);
        setInitial({ mode: 'auto', accent: 'coral', density: 'comfy', sidebarSide: 'left' });
      });
  }, []);

  if (!initial) return null;

  const persist = {
    setMode: (m: ThemeMode) => { void window.jide.settings.set('theme', m); },
    setAccent: (a: AccentId) => { void window.jide.settings.set('accent', a); },
    setDensity: (d: DensityId) => { void window.jide.settings.set('density', d); },
    setSidebarSide: (s: SidebarSide) => { void window.jide.settings.set('sidebarSide', s); },
  };

  return (
    <ThemeProvider initial={initial} persist={persist}>
      <App />
    </ThemeProvider>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('No #root');
createRoot(container).render(<StrictMode><Root /></StrictMode>);
```

### Step 2.5: `styles.css` minimum: generalize keyframes

```css
:root {
  --jide-accent: #F95A5C; /* updated at runtime by ThemeProvider */
}

* { box-sizing: border-box; }
html, body, #root { margin: 0; padding: 0; height: 100%; }

body {
  font-family:
    'Open Sauce One',
    system-ui, -apple-system, sans-serif;
  overflow: hidden;
  /* background and color are painted by themed components */
}

@keyframes jidePulse {
  0%   { box-shadow: 0 0 0 0 var(--jide-accent); opacity: 0.6; }
  100% { box-shadow: 0 0 0 8px transparent; opacity: 0;       }
}

@keyframes jideBlink {
  0%, 80%, 100% { opacity: 0.2; }
  40%           { opacity: 1; }
}
```

> Quita `--jide-bg` y `--jide-fg`. Los componentes ahora pintan vía `useTheme()`. La regla `body` baja de `background: var(--jide-bg)` a sin fondo, porque el shell de `<App />` siempre cubre la viewport.

### Step 2.6: Tests `tests/unit/renderer/theme.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useTheme } from '@renderer/theme/useTheme';
import { ThemeProvider } from '@renderer/theme/ThemeProvider';

function Probe() {
  const t = useTheme();
  return (
    <div
      data-testid="probe"
      data-mode={t.effectiveMode}
      data-accent={t.accent.id}
      data-density-row={t.density.row}
      data-side={t.sidebarSide}
      style={{ background: t.theme.appBg }}
    />
  );
}

function setup(initialMode: 'light' | 'dark' | 'auto' = 'light', mq?: boolean) {
  const persist = { setMode: vi.fn(), setAccent: vi.fn(), setDensity: vi.fn(), setSidebarSide: vi.fn() };
  const matches = mq ?? false;
  const listeners = new Set<() => void>();
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches,
    addEventListener: (_e: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_e: string, fn: () => void) => listeners.delete(fn),
    media: '',
    onchange: null,
    dispatchEvent: () => true,
    addListener: () => {},
    removeListener: () => {},
  } as unknown as MediaQueryList);

  const { getByTestId } = render(
    <ThemeProvider
      initial={{ mode: initialMode, accent: 'coral', density: 'comfy', sidebarSide: 'left' }}
      persist={persist}
    >
      <Probe />
    </ThemeProvider>,
  );
  return { probe: () => getByTestId('probe'), persist, listeners };
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('--jide-accent');
  });

  it('resolves explicit light mode', () => {
    const { probe } = setup('light');
    expect(probe().dataset.mode).toBe('light');
  });

  it('resolves explicit dark mode', () => {
    const { probe } = setup('dark');
    expect(probe().dataset.mode).toBe('dark');
  });

  it('resolves auto via prefers-color-scheme', () => {
    const { probe } = setup('auto', true);
    expect(probe().dataset.mode).toBe('dark');
  });

  it('syncs --jide-accent on :root', () => {
    setup('light');
    expect(document.documentElement.style.getPropertyValue('--jide-accent')).toBe('#F95A5C');
  });

  it('throws if useTheme is used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/within <ThemeProvider>/);
    spy.mockRestore();
  });
});
```

> Si `@testing-library/react` no está instalado todavía: `pnpm add -D @testing-library/react @testing-library/jest-dom`. Si ya está, omitir. Verificar con `pnpm list @testing-library/react` antes de añadir.

### Step 2.7: Verify

```bash
pnpm vitest run tests/unit/renderer/theme.test.tsx
pnpm tsc --noEmit
```

Commit as `feat(theme): provider with auto mode and css var sync`.

---

## Task 3: Refactor `App.tsx` — wrap layout, react to sidebarSide, no hardcoded styles

**Files:**
- Modify: `src/renderer/src/App.tsx`

### Step 3.1: Cambios estructurales

- El `<div>` raíz pasa de `flexDirection: 'row'` fijo a `sidebarSide === 'right' ? 'row-reverse' : 'row'`.
- Background lo paint la página: `useTheme().theme.appBg`.
- El layout interno deja sitio para `TopChromeStrip` (arriba), un body que contiene `Sidebar | main` y un footer `StatusBar`.
- Por ahora, el cuerpo `main` sigue mostrando solo `ChatPanel` — la `TabBar` la añade Task 6. Aquí solo dejamos el contenedor:

```tsx
import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/Chat';
import { NewWorktreeDialog } from './components/dialogs/NewWorktreeDialog';
import { TopChromeStrip } from './components/Chrome/TopChromeStrip';
import { StatusBar } from './components/StatusBar/StatusBar';
import { useProjects } from './shortcuts/useProjects';
import { useTheme } from './theme/useTheme';

export function App() {
  const { theme, sidebarSide } = useTheme();
  const { projects, add, toggleExpanded } = useProjects();
  const [activeWorktreeId, setActiveWorktreeId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [dialogOpenFor, setDialogOpenFor] = useState<string | null>(null);
  const [maxSessions, setMaxSessions] = useState<number>(4);

  useEffect(() => {
    window.jide.settings.get('maxSessionsPerWorktree')
      .then(setMaxSessions)
      .catch((err: unknown) => console.error('[jide] settings:get maxSessionsPerWorktree failed', err));
  }, []);

  const activeWt = projects.flatMap((p) => p.worktrees).find((w) => w.id === activeWorktreeId) ?? null;
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: theme.appBg,
        color: theme.text,
      }}
    >
      <TopChromeStrip project={activeProject} worktree={activeWt} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: sidebarSide === 'right' ? 'row-reverse' : 'row',
          minHeight: 0,
        }}
      >
        <Sidebar
          projects={projects}
          activeWorktreeId={activeWorktreeId}
          onToggleProject={toggleExpanded}
          onSelectWorktree={(id) => {
            setActiveWorktreeId(id);
            const matched = projects.find((p) => id.startsWith(`${p.path}:`));
            if (matched) setActiveProjectId(matched.id);
          }}
          onAddProject={() => add().catch((err: unknown) => console.error('[jide] projects:add failed', err))}
          onNewWorktree={() => {
            if (activeProjectId) setDialogOpenFor(activeProjectId);
            else if (projects[0]) setDialogOpenFor(projects[0].id);
          }}
        />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: theme.panelBg }}>
          {/* TabBar inserted in Task 6 */}
          <ChatPanel worktreeId={activeWorktreeId} maxSessionsPerWorktree={maxSessions} />
        </main>
      </div>
      <StatusBar project={activeProject} worktree={activeWt} />

      {dialogOpenFor && (
        <NewWorktreeDialog
          project={projects.find((p) => p.id === dialogOpenFor) ?? projects[0]!}
          onCancel={() => setDialogOpenFor(null)}
          onCreated={() => setDialogOpenFor(null)}
        />
      )}
    </div>
  );
}
```

> En Task 6 los `setActiveWorktreeId`/`setActiveProjectId` se sustituyen por `useTabs()`. Mantener el shape de momento facilita revisar el commit en isolation.

### Step 3.2: Verify

```bash
pnpm dev    # smoke local — la app debe arrancar; veremos placeholders de StatusBar/TopChrome
pnpm tsc --noEmit
```

Commit as `refactor(app): wire ThemeProvider context and prep shell layout`.

---

## Task 4: Sidebar refactor — consume `useTheme`, support side prop, fully themed children

**Files:**
- Modify: `src/renderer/src/components/Sidebar/Sidebar.tsx`
- Modify: `src/renderer/src/components/Sidebar/SidebarSection.tsx`
- Modify: `src/renderer/src/components/Sidebar/SidebarRow.tsx`
- Modify: `src/renderer/src/components/Sidebar/ProjectBranch.tsx`
- Modify: `src/renderer/src/components/Sidebar/ProjectNode.tsx`
- Modify: `src/renderer/src/components/Sidebar/WorktreeRow.tsx`
- Modify: `src/renderer/src/components/icons/Kbd.tsx`
- Modify: `src/renderer/src/components/icons/StatusDot.tsx`

### Step 4.1: `Sidebar.tsx`

Sustituir todos los `#F6F4EF`, `#00000010`, hex hardcoded del wordmark por tokens. Apoyarse en `density.side` para el ancho y en `sidebarSide` para el borde:

```tsx
import type { Project } from '@shared/project';
import { useRef } from 'react';
import { SidebarSection } from './SidebarSection';
import { SidebarRow } from './SidebarRow';
import { ProjectBranch } from './ProjectBranch';
import { useTheme } from '../../theme/useTheme';
import { TweaksPanel } from '../Tweaks/TweaksPanel';
import { useState } from 'react';

export function Sidebar({
  projects, activeWorktreeId, onToggleProject, onSelectWorktree, onAddProject, onNewWorktree,
}: {
  projects: Project[];
  activeWorktreeId: string | null;
  onToggleProject: (id: string) => void;
  onSelectWorktree: (id: string) => void;
  onAddProject: () => void;
  onNewWorktree: () => void;
}) {
  const { theme, accent, density, sidebarSide } = useTheme();
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  const borderProp = sidebarSide === 'left' ? 'borderRight' : 'borderLeft';

  return (
    <aside
      data-testid="sidebar"
      style={{
        width: density.side, flexShrink: 0, height: '100%',
        background: theme.sidebarBg, [borderProp]: `1px solid ${theme.borderHair}`,
        display: 'flex', flexDirection: 'column', fontSize: density.font,
      }}
    >
      <div style={{ padding: '12px 14px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontFamily: '"Bowlby One SC", Anton, Impact, sans-serif',
            fontSize: 22, color: accent.value, letterSpacing: -0.5,
          }}
        >
          jide
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: `4px ${density.gap}px 12px` }}>
        <SidebarSection label="Proyectos">
          {projects.map((p) => (
            <ProjectBranch
              key={p.id}
              project={p}
              activeWorktreeId={activeWorktreeId}
              onToggle={() => onToggleProject(p.id)}
              onSelectWorktree={onSelectWorktree}
            />
          ))}
        </SidebarSection>

        <SidebarSection label="Atajos" style={{ marginTop: 14 }}>
          <SidebarRow icon="plus" onClick={onNewWorktree} kbd="⌘N">
            Nuevo worktree
          </SidebarRow>
          <SidebarRow icon="folder" onClick={onAddProject} kbd="⌘O">
            Añadir proyecto
          </SidebarRow>
          <SidebarRow
            icon="settings"
            kbd="⌘,"
            onClick={() => setTweaksOpen((v) => !v)}
            anchorRef={settingsBtnRef}
            data-testid="sidebar-settings"
          >
            Ajustes
          </SidebarRow>
        </SidebarSection>
      </div>

      {tweaksOpen && (
        <TweaksPanel
          anchorRef={settingsBtnRef}
          side={sidebarSide}
          onClose={() => setTweaksOpen(false)}
        />
      )}
    </aside>
  );
}
```

> El `anchorRef` se pasa a `SidebarRow` para que el popover sepa dónde anclarse. Lo añadimos a `SidebarRow` como prop opcional en Step 4.2.

### Step 4.2: `SidebarRow.tsx`

Añade `anchorRef` opcional y bebe del theme:

```tsx
import { useState, type ReactNode, type Ref } from 'react';
import { JIcon } from '../icons/JIcon';
import { Kbd } from '../icons/Kbd';
import { useTheme } from '../../theme/useTheme';

export function SidebarRow({
  icon, children, onClick, kbd, anchorRef, 'data-testid': testId,
}: {
  icon: 'plus' | 'folder' | 'settings';
  children: ReactNode;
  onClick?: () => void;
  kbd?: string;
  anchorRef?: Ref<HTMLButtonElement>;
  'data-testid'?: string;
}) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  return (
    <button
      ref={anchorRef}
      type="button"
      onClick={onClick}
      data-testid={testId}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 10px', height: 28,
        border: 0, background: hover ? theme.hoverBg : 'transparent',
        color: theme.text, cursor: 'pointer', borderRadius: 6, textAlign: 'left',
        fontFamily: 'inherit', fontSize: 'inherit',
      }}
    >
      <JIcon name={icon} size={13} style={{ color: theme.textMed }} />
      <span style={{ flex: 1 }}>{children}</span>
      {kbd && <Kbd>{kbd}</Kbd>}
    </button>
  );
}
```

### Step 4.3: `SidebarSection.tsx`, `ProjectBranch.tsx`, `ProjectNode.tsx`, `WorktreeRow.tsx`

Todos consumen `useTheme()`. Sustituir los hardcoded:

- `SidebarSection`: `color: '#00000060'` → `theme.textLow`.
- `ProjectBranch`/`ProjectNode`: backgrounds, separadores y text colors → tokens. Usar `density.row` para altura.
- `WorktreeRow`: eliminar `const ACCENT = '#F95A5C';` — leer de `accent.value`. Backgrounds `'#FFE3E3'`/`'#00000008'` → `accent.bg`/`theme.hoverBg`. Pintar el indicador izquierdo activo con `accent.value`.

### Step 4.4: `Kbd.tsx`, `StatusDot.tsx`

```tsx
// Kbd.tsx
import type { ReactNode } from 'react';
import { useTheme } from '../../theme/useTheme';

export function Kbd({ children }: { children: ReactNode }): JSX.Element {
  const { theme } = useTheme();
  return (
    <kbd
      style={{
        fontFamily: 'Geist, ui-monospace, monospace',
        fontSize: 10.5, padding: '1px 6px', borderRadius: 4,
        background: theme.panelMuted, color: theme.textMed,
        border: `1px solid ${theme.borderHair}`, fontWeight: 500,
      }}
    >
      {children}
    </kbd>
  );
}
```

`StatusDot`: ya inyecta accent indirectamente; explícito vía `useTheme()`. El `running` aplica `animation: 'jidePulse 1.6s ease-out infinite'` y el color sigue siendo `accent.value` (el keyframe usa la CSS var, así que se mantiene).

### Step 4.5: Verify

```bash
pnpm dev
# Abrir la app, alternar themeMode manualmente en settings store (vía DevTools console:
# await window.jide.settings.set('theme', 'dark') ) y verificar que la Sidebar cambia.
pnpm tsc --noEmit
```

Commit as `refactor(sidebar): consume theme tokens and prep tweaks anchor`.

---

## Task 5: Chat components — purge hardcoded styling

**Files:**
- Modify: `src/renderer/src/components/Chat/ChatPanel.tsx`
- Modify: `src/renderer/src/components/Chat/Composer.tsx`
- Modify: `src/renderer/src/components/Chat/UserMessage.tsx`
- Modify: `src/renderer/src/components/Chat/ClaudeMessage.tsx`
- Modify: `src/renderer/src/components/Chat/ToolMessage.tsx`
- Modify: `src/renderer/src/components/Chat/DiffMessage.tsx`
- Modify: `src/renderer/src/components/Chat/SystemMessage.tsx`
- Modify: `src/renderer/src/components/Chat/ApprovalBar.tsx`
- Modify: `src/renderer/src/components/Chat/StreamingIndicator.tsx`
- Modify: `src/renderer/src/components/Chat/SessionStrip.tsx`
- Modify: `src/renderer/src/components/Chat/SessionChip.tsx`
- Modify: `src/renderer/src/components/Chat/SessionMeta.tsx`
- Modify: `src/renderer/src/components/Chat/EmptySessions.tsx`

### Step 5.1: Sustituciones canónicas

Para cada componente del directorio `Chat/`:

| Hardcoded actual | Sustituto |
|---|---|
| `#F95A5C` (accent) | `accent.value` |
| `#FFFFFF` text-on-accent | `'#FFFFFF'` (intencional sobre el accent) |
| `#1F1F1F` | `theme.text` |
| `#666666` / `#0000007F` | `theme.textMed` |
| `#8F8F8F` | `theme.textLow` |
| `#FFFFFF` (panel) | `theme.panelBg` |
| `#FAFAFA` | `theme.panelMuted` |
| `#EBEBEB` border | `theme.border` |
| `#E6E3DE` borderHair | `theme.borderHair` |
| `#00000010`/`08` hover/border | `theme.hoverBg` / `theme.borderHair` |
| `#ECFDF0` add bg | `theme.diffAddBg` |
| `#028E5C` add text | `theme.diffAddText` |
| `#FEF3F2` del bg | `theme.diffDelBg` |
| `#DA3D28` del text | `theme.diffDelText` |

Cada componente añade al principio: `const { theme, accent, density } = useTheme();` y reemplaza inline.

### Step 5.2: `Composer.tsx` específico

El botón de submit:

```tsx
background: disabled || !text.trim() ? theme.hoverBg : accent.value,
color: '#FFFFFF',
```

Textarea bg → `theme.inputBg`, color → `theme.text`, border focus → `accent.value`.

### Step 5.3: `UserMessage.tsx` específico

Burbuja del usuario:

```tsx
background: accent.value,
color: '#FFFFFF',
```

### Step 5.4: `StreamingIndicator.tsx` específico

Los tres puntos blink usan `animation: 'jideBlink 1.4s infinite ease-in-out'` (ya en `styles.css`). Color de los puntos → `accent.value` (el blink modula opacidad, no color).

### Step 5.5: Verify

```bash
pnpm dev
# Mandar un prompt al fake-claude desde el composer. Verificar:
# - burbuja user pinta accent
# - submit button activo pinta accent
# - dark mode: input bg dark, texto claro
pnpm tsc --noEmit
```

Commit as `refactor(chat): replace hardcoded colors with theme tokens`.

---

## Task 6: `TabBar` + `Tab` + `useTabs` hook

**Files:**
- Create: `src/renderer/src/shortcuts/useTabs.ts`
- Create: `src/renderer/src/components/TabBar/TabBar.tsx`
- Create: `src/renderer/src/components/TabBar/Tab.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/components/icons/JIcon.tsx` (add `'plus'` already exists; verify it does)

### Step 6.1: `useTabs.ts`

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TabRef } from '@shared/settings';
import type { Project } from '@shared/project';

const PERSIST_DEBOUNCE_MS = 200;

export interface UseTabsResult {
  tabs: TabRef[];
  activeWorktreeId: string | null;
  open: (worktreeId: string, projectId: string) => void;
  close: (worktreeId: string) => void;
  setActive: (worktreeId: string) => void;
}

/**
 * Tab list lives in settings (openTabs, lastWorktreeId). Hydrates on mount,
 * filters orphan tabs (worktreeIds not present in current projects), then
 * tracks state in memory and debounces writes back to settings.
 */
export function useTabs(projects: Project[]): UseTabsResult {
  const [tabs, setTabs] = useState<TabRef[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const hydrated = useRef(false);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate once from settings + filter orphans against known projects.
  useEffect(() => {
    if (hydrated.current) return;
    if (projects.length === 0) return; // wait until projects are loaded
    hydrated.current = true;
    void (async () => {
      const [stored, last] = await Promise.all([
        window.jide.settings.get('openTabs'),
        window.jide.settings.get('lastWorktreeId'),
      ]);
      const validIds = new Set(projects.flatMap((p) => p.worktrees.map((w) => w.id)));
      const filtered = stored.filter((t) => validIds.has(t.worktreeId));
      setTabs(filtered);
      setActiveId(filtered.some((t) => t.worktreeId === last) ? last : filtered[0]?.worktreeId ?? null);
    })().catch((err: unknown) => console.error('[jide] tabs hydrate failed', err));
  }, [projects]);

  // Debounced persistence (single timer per change burst).
  const persist = useCallback((nextTabs: TabRef[], nextActive: string | null) => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      void window.jide.settings.set('openTabs', nextTabs);
      void window.jide.settings.set('lastWorktreeId', nextActive);
    }, PERSIST_DEBOUNCE_MS);
  }, []);

  const open = useCallback((worktreeId: string, projectId: string) => {
    setTabs((prev) => {
      const next = prev.some((t) => t.worktreeId === worktreeId)
        ? prev
        : [...prev, { worktreeId, projectId }];
      persist(next, worktreeId);
      return next;
    });
    setActiveId(worktreeId);
  }, [persist]);

  const close = useCallback((worktreeId: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.worktreeId !== worktreeId);
      let nextActive: string | null = null;
      setActiveId((curr) => {
        if (curr !== worktreeId) {
          nextActive = curr;
          return curr;
        }
        const remaining = next[next.length - 1]?.worktreeId ?? null;
        nextActive = remaining;
        return remaining;
      });
      persist(next, nextActive);
      return next;
    });
  }, [persist]);

  const setActive = useCallback((worktreeId: string) => {
    setActiveId(worktreeId);
    setTabs((prev) => {
      persist(prev, worktreeId);
      return prev;
    });
  }, [persist]);

  return { tabs, activeWorktreeId: activeId, open, close, setActive };
}
```

### Step 6.2: `Tab.tsx`

```tsx
import { useState } from 'react';
import type { Project, Worktree } from '@shared/project';
import { JIcon } from '../icons/JIcon';
import { StatusDot } from '../icons/StatusDot';
import { useTheme } from '../../theme/useTheme';

export function Tab({
  project, worktree, active, onSelect, onClose,
}: {
  project: Project;
  worktree: Worktree;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const { theme, accent, density } = useTheme();
  const [hover, setHover] = useState(false);
  const [hoverX, setHoverX] = useState(false);
  const modified = worktree.changes > 0;
  const bg = active ? theme.panelBg : (hover ? theme.hoverBg : 'transparent');

  return (
    <div
      role="tab"
      aria-selected={active}
      data-testid={`tab-${worktree.id}`}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={onSelect}
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8,
        height: density.tabH, padding: '0 10px 0 12px',
        marginTop: 4, background: bg,
        borderRight: `1px solid ${theme.borderHair}`,
        cursor: 'pointer', maxWidth: 260, minWidth: 130,
        fontFamily: 'Geist, ui-monospace, monospace',
        fontSize: density.mono,
        color: active ? theme.text : theme.textMed,
        fontWeight: active ? 600 : 500,
      }}
    >
      {active && (
        <span
          style={{
            position: 'absolute', left: 0, right: 0, top: -4, height: 2,
            background: accent.value,
          }}
        />
      )}
      <StatusDot state={worktree.claude?.state ?? 'idle'} size={6} />
      <span style={{
        color: active ? theme.textMed : theme.textLow, fontWeight: 500,
        fontFamily: 'Open Sauce One, sans-serif', fontSize: 11,
      }}>{project.name}</span>
      <span style={{ color: theme.textLow, fontWeight: 400 }}>/</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {worktree.branch}
      </span>
      <button
        aria-label="Cerrar tab"
        onMouseEnter={() => setHoverX(true)} onMouseLeave={() => setHoverX(false)}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          width: 18, height: 18, borderRadius: 4,
          border: 0, background: hoverX ? theme.selectedBg : 'transparent',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: theme.textMed, cursor: 'pointer', padding: 0,
        }}
      >
        {modified && !hoverX ? (
          <span style={{ width: 7, height: 7, borderRadius: 999, background: theme.textMed }} />
        ) : (
          <JIcon name="x" size={11} />
        )}
      </button>
    </div>
  );
}
```

> **Nota sobre `worktree.claude?.state`:** Fase 4 hizo el rollup; `Worktree.claude` es `ClaudeState | null`. Verificar en `src/shared/project.ts` el shape exacto y ajustar la prop a `StatusDot` (puede ser `worktree.claude` directo, igual que en `WorktreeRow.tsx`).

### Step 6.3: `TabBar.tsx`

```tsx
import type { Project } from '@shared/project';
import type { TabRef } from '@shared/settings';
import { Tab } from './Tab';
import { JIcon } from '../icons/JIcon';
import { useTheme } from '../../theme/useTheme';

export function TabBar({
  tabs, projects, activeWorktreeId, onSelect, onClose, onNew,
}: {
  tabs: TabRef[];
  projects: Project[];
  activeWorktreeId: string | null;
  onSelect: (worktreeId: string, projectId: string) => void;
  onClose: (worktreeId: string) => void;
  onNew: () => void;
}) {
  const { theme, density } = useTheme();
  return (
    <div
      role="tablist"
      data-testid="tab-bar"
      style={{
        display: 'flex', alignItems: 'stretch',
        background: theme.tabbarBg,
        borderBottom: `1px solid ${theme.borderHair}`,
        height: density.tabH + 4, flexShrink: 0, overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, overflow: 'auto' }}>
        {tabs.map((t) => {
          const project = projects.find((p) => p.id === t.projectId);
          const wt = project?.worktrees.find((w) => w.id === t.worktreeId);
          if (!project || !wt) return null;
          return (
            <Tab
              key={t.worktreeId}
              project={project}
              worktree={wt}
              active={t.worktreeId === activeWorktreeId}
              onSelect={() => onSelect(t.worktreeId, t.projectId)}
              onClose={() => onClose(t.worktreeId)}
            />
          );
        })}
        <button
          aria-label="Nuevo worktree"
          onClick={onNew}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            height: density.tabH, padding: '0 12px',
            border: 0, background: 'transparent', color: theme.textMed,
            cursor: 'pointer', marginTop: 4,
          }}
        >
          <JIcon name="plus" size={14} />
        </button>
      </div>
    </div>
  );
}
```

### Step 6.4: Integrar en `App.tsx`

Sustituir `useState<string | null>(null)` por `useTabs(projects)`:

```tsx
const { tabs, activeWorktreeId, open: openTab, close: closeTab } = useTabs(projects);

// onSelectWorktree de la Sidebar:
onSelectWorktree={(id) => {
  const matched = projects.find((p) => id.startsWith(`${p.path}:`));
  if (matched) openTab(id, matched.id);
}}

// Inside <main>, antes de <ChatPanel>:
<TabBar
  tabs={tabs}
  projects={projects}
  activeWorktreeId={activeWorktreeId}
  onSelect={(wid, pid) => openTab(wid, pid)}
  onClose={closeTab}
  onNew={() => { if (activeProject) setDialogOpenFor(activeProject.id); }}
/>
```

> `activeProjectId` se deriva ahora del `activeWorktreeId` actual buscando en `projects`.

### Step 6.5: Verify

```bash
pnpm dev
# - Click en un worktree desde sidebar → aparece tab.
# - Click en otro → segunda tab.
# - Click en tab existente → cambia activo, no duplica.
# - Cerrar tab activa → selecciona la siguiente.
# - Restart app → tabs y activo se restauran.
pnpm tsc --noEmit
```

Commit as `feat(tabs): persistent worktree tab bar with useTabs hook`.

---

## Task 7: `TopChromeStrip` + `PaletteButton`

**Files:**
- Create: `src/renderer/src/components/Chrome/TopChromeStrip.tsx`
- Create: `src/renderer/src/components/Chrome/PaletteButton.tsx`
- Modify: `src/renderer/src/components/icons/JIcon.tsx` (add `'command'`, `'folder'` ya existe; extender si falta)

### Step 7.1: Iconos faltantes en `JIcon.tsx`

Verificar y añadir si no existen: `command`, `folder` (existe), `branch` (existe).

```ts
'command': 'M9 6a3 3 0 1 1 0 6h6a3 3 0 1 1 0 6m0-6V6m-6 6h6m-6 0a3 3 0 1 1 0 6m6-6a3 3 0 1 1 0-6',
```

(SVG aproximada — ajustar al estilo existente del set.)

### Step 7.2: `PaletteButton.tsx`

```tsx
import { JIcon } from '../icons/JIcon';
import { useTheme } from '../../theme/useTheme';

export function PaletteButton({ onClick }: { onClick: () => void }): JSX.Element {
  const { theme } = useTheme();
  return (
    <button
      aria-label="Abrir paleta de comandos (⌘K)"
      onClick={onClick}
      style={{
        WebkitAppRegion: 'no-drag',
        height: 22, padding: '0 8px',
        display: 'inline-flex', alignItems: 'center', gap: 5,
        borderRadius: 5, border: `1px solid ${theme.border}`,
        background: theme.panelMuted, color: theme.textMed, cursor: 'pointer',
        fontSize: 11, fontFamily: 'inherit',
      } as React.CSSProperties}
    >
      <JIcon name="command" size={10} />
      <span>K</span>
    </button>
  );
}
```

### Step 7.3: `TopChromeStrip.tsx`

```tsx
import type { Project, Worktree } from '@shared/project';
import { JIcon } from '../icons/JIcon';
import { useTheme } from '../../theme/useTheme';
import { PaletteButton } from './PaletteButton';

export function TopChromeStrip({
  project, worktree,
}: {
  project: Project | null;
  worktree: Worktree | null;
}) {
  const { theme, sidebarSide } = useTheme();
  // Reserve left padding for native traffic lights when sidebar lives on the left.
  const padLeft = sidebarSide === 'left' ? 78 : 16;
  const padRight = sidebarSide === 'right' ? 78 : 16;
  return (
    <div
      data-testid="top-chrome"
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        height: 30, padding: `0 ${padRight}px 0 ${padLeft}px`,
        background: theme.appBg, flexShrink: 0,
        borderBottom: `1px solid ${theme.borderHair}`,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      <div style={{ flex: 1 }} />
      {worktree && project && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          color: theme.textMed, fontSize: 12,
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}>
          <JIcon name="folder" size={12} />
          <span style={{ fontFamily: 'Geist, monospace' }}>{project.name}</span>
          <span style={{ color: theme.textLow }}>/</span>
          <span style={{ fontFamily: 'Geist, monospace', color: theme.text, fontWeight: 600 }}>
            {worktree.branch}
          </span>
          {worktree.changes > 0 && (
            <span style={{
              marginLeft: 6, padding: '1px 6px', borderRadius: 4,
              background: theme.warning + '1F', color: theme.warning,
              fontFamily: 'Geist, monospace', fontSize: 10.5, fontWeight: 600,
            }}>
              {worktree.changes} cambios
            </span>
          )}
        </div>
      )}
      <div style={{ flex: 1 }} />
      <PaletteButton
        onClick={() => {
          console.warn('[jide] command palette: pending Fase 8');
        }}
      />
    </div>
  );
}
```

### Step 7.4: Verify

```bash
pnpm dev
# - Arrastrar la app desde la zona del breadcrumb → la ventana se mueve.
# - Hover sobre el breadcrumb (modified > 0): badge naranja con count.
# - Sidebar a la derecha (via DevTools settings.set): padding del strip se invierte.
```

Commit as `feat(chrome): top strip with draggable region and palette button`.

---

## Task 8: `StatusBar` + `StatusItem`

**Files:**
- Create: `src/renderer/src/components/StatusBar/StatusBar.tsx`
- Create: `src/renderer/src/components/StatusBar/StatusItem.tsx`
- Modify: `src/renderer/src/components/icons/JIcon.tsx` (add `'arrow-up'`, `'arrow-down'`, `'diff'`, `'claude'`, `'cli'`, `'terminal'`, `'eye'`, `'split-v'`, `'split-h'`)

### Step 8.1: Iconos nuevos

Aproximar el set del mock (`design/project/jide/icons.jsx` si existe) o silhouettes sencillas:

```ts
'arrow-up':   'M12 19V5M5 12l7-7 7 7',
'arrow-down': 'M12 5v14M5 12l7 7 7-7',
'diff':       'M9 4v16M15 4v16M4 9h16M4 15h16',
'claude':     'M5 12a7 7 0 1 0 14 0 7 7 0 0 0-14 0Zm7-7v14',
'cli':        'M4 7l5 5-5 5M12 17h8',
'terminal':   'M4 6h16v12H4zM6 10l3 2-3 2',
'eye':        'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
'split-v':    'M3 5h18v14H3zM12 5v14',
'split-h':    'M3 5h18v14H3zM3 12h18',
```

> Estos son placeholders razonables. Si el mock define paths distintos en `icons.jsx`, importar literal. Comprobar con `grep "split-v" design/project/jide/icons.jsx`.

### Step 8.2: `StatusItem.tsx`

```tsx
import type { CSSProperties, ReactNode } from 'react';
import { JIcon } from '../icons/JIcon';

const IconNames = ['branch', 'arrow-up', 'arrow-down', 'diff', 'claude', 'cli'] as const;
export type StatusIconName = (typeof IconNames)[number];

export function StatusItem({
  icon, children, style,
}: {
  icon: StatusIconName;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '0 10px', height: '100%', ...style,
      }}
    >
      <JIcon name={icon} size={11} style={{ opacity: 0.85 }} />
      <span style={{ opacity: 0.95 }}>{children}</span>
    </span>
  );
}
```

### Step 8.3: `StatusBar.tsx`

```tsx
import type { Project, Worktree } from '@shared/project';
import { StatusItem } from './StatusItem';
import { useTheme } from '../../theme/useTheme';

export function StatusBar({
  project, worktree,
}: {
  project: Project | null;
  worktree: Worktree | null;
}) {
  const { accent } = useTheme();
  if (!worktree || !project) {
    // Render an empty band so layout doesn't collapse.
    return (
      <footer
        data-testid="status-bar"
        style={{
          height: 26, flexShrink: 0, background: accent.value, color: '#FFFFFF',
        }}
      />
    );
  }

  const claudeLabel = (() => {
    const state = worktree.claude?.state ?? 'idle';
    if (state === 'running')  return 'claude · ejecutando';
    if (state === 'awaiting') return 'claude · esperando';
    if (state === 'idle')     return 'claude · en reposo';
    if (state === 'error')    return 'claude · error';
    return `claude · ${state}`;
  })();

  return (
    <footer
      data-testid="status-bar"
      style={{
        display: 'flex', alignItems: 'center', gap: 0,
        height: 26, padding: '0 4px 0 0', flexShrink: 0,
        background: accent.value, color: '#FFFFFF',
        fontFamily: 'Geist, ui-monospace, monospace', fontSize: 11.5,
      }}
    >
      <StatusItem icon="branch">{worktree.branch}</StatusItem>
      <StatusItem icon="arrow-up">{worktree.ahead}</StatusItem>
      <StatusItem icon="arrow-down">{worktree.behind}</StatusItem>
      <StatusItem icon="diff">{worktree.changes} cambios</StatusItem>
      <div style={{ flex: 1 }} />
      <StatusItem icon="claude">{claudeLabel}</StatusItem>
      <StatusItem icon="cli">$ {project.path}</StatusItem>
    </footer>
  );
}
```

> Los botones Term/Visor/Comandos del mock son afordances de Fases 6/7/8. Aquí dejamos sólo lectura. Documentamos en el commit body que se añadirán en su fase.

### Step 8.4: Verify

```bash
pnpm dev
# - Banda inferior pintada con accent.
# - Cambiar accent vía settings → banda cambia.
# - Worktree con changes>0 → "N cambios" aparece.
pnpm tsc --noEmit
```

Commit as `feat(statusbar): footer band with worktree git and claude state`.

---

## Task 9: `TweaksPanel` popover + sections

**Files:**
- Create: `src/renderer/src/components/Tweaks/TweaksPanel.tsx`
- Create: `src/renderer/src/components/Tweaks/TweakSection.tsx`
- Create: `src/renderer/src/components/Tweaks/TweakRadio.tsx`
- Create: `src/renderer/src/components/Tweaks/TweakColor.tsx`

### Step 9.1: `TweakSection.tsx`

```tsx
import type { ReactNode } from 'react';
import { useTheme } from '../../theme/useTheme';

export function TweakSection({ label, children }: { label: string; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        padding: '4px 0', fontSize: 10.5, fontWeight: 600,
        letterSpacing: 0.6, textTransform: 'uppercase', color: theme.textLow,
      }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}
```

### Step 9.2: `TweakRadio.tsx`

```tsx
import { useTheme } from '../../theme/useTheme';

export function TweakRadio<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  const { theme, accent } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: theme.textMed, minWidth: 70 }}>{label}</span>
      <div style={{
        display: 'inline-flex', borderRadius: 6,
        border: `1px solid ${theme.border}`, background: theme.panelMuted, padding: 2, gap: 2,
      }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              style={{
                padding: '4px 10px', border: 0, borderRadius: 4,
                background: active ? accent.value : 'transparent',
                color: active ? '#FFFFFF' : theme.textMed,
                fontFamily: 'inherit', fontSize: 11, cursor: 'pointer',
                fontWeight: active ? 600 : 500,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

### Step 9.3: `TweakColor.tsx`

```tsx
import { ACCENTS, type AccentId } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

export function TweakColor({
  label, value, onChange,
}: {
  label: string;
  value: AccentId;
  onChange: (next: AccentId) => void;
}) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: theme.textMed, minWidth: 70 }}>{label}</span>
      <div style={{ display: 'inline-flex', gap: 6 }}>
        {Object.values(ACCENTS).map((a) => {
          const active = a.id === value;
          return (
            <button
              key={a.id}
              type="button"
              aria-label={a.name}
              title={a.name}
              onClick={() => onChange(a.id)}
              style={{
                width: 22, height: 22, borderRadius: 999, padding: 0,
                border: active ? `2px solid ${theme.text}` : `1px solid ${theme.border}`,
                background: a.value, cursor: 'pointer',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
```

### Step 9.4: `TweaksPanel.tsx`

Popover básico con backdrop click-outside. Sin librería externa.

```tsx
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useTheme } from '../../theme/useTheme';
import type { SidebarSide } from '../../theme/tokens';
import { TweakSection } from './TweakSection';
import { TweakRadio } from './TweakRadio';
import { TweakColor } from './TweakColor';

export function TweaksPanel({
  anchorRef, side, onClose,
}: {
  anchorRef: RefObject<HTMLButtonElement>;
  side: SidebarSide;
  onClose: () => void;
}) {
  const { theme, mode, accent, density, sidebarSide, setMode, setAccent, setDensity, setSidebarSide } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Position next to the anchor button (right or left depending on sidebar side).
  useLayoutEffect(() => {
    const a = anchorRef.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const width = 260;
    const left = side === 'left' ? r.right + 6 : r.left - width - 6;
    setPos({ top: r.top, left });
  }, [anchorRef, side]);

  // Click outside + Esc to close.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchorRef.current?.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [anchorRef, onClose]);

  if (!pos) return null;
  return (
    <div
      ref={ref}
      role="dialog"
      data-testid="tweaks-panel"
      style={{
        position: 'fixed', top: pos.top, left: pos.left, width: 260,
        padding: 12,
        background: theme.panelBg, color: theme.text,
        border: `1px solid ${theme.border}`, borderRadius: 10,
        boxShadow: theme.popoverShadow,
        zIndex: 50, fontFamily: 'inherit', fontSize: 12,
      }}
    >
      <div style={{ fontFamily: 'inherit', fontWeight: 600, fontSize: 13 }}>Tweaks · jide</div>

      <TweakSection label="Tema">
        <TweakRadio
          label="Modo"
          value={mode}
          options={[
            { value: 'light', label: 'light' },
            { value: 'dark', label: 'dark' },
            { value: 'auto', label: 'auto' },
          ]}
          onChange={setMode}
        />
        <TweakColor label="Acento" value={accent.id} onChange={setAccent} />
      </TweakSection>

      <TweakSection label="Layout">
        <TweakRadio
          label="Densidad"
          value={density.row === 24 ? 'compact' : 'comfy'}
          options={[
            { value: 'compact', label: 'compact' },
            { value: 'comfy', label: 'comfy' },
          ]}
          onChange={setDensity}
        />
        <TweakRadio
          label="Sidebar"
          value={sidebarSide}
          options={[
            { value: 'left', label: 'izq' },
            { value: 'right', label: 'der' },
          ]}
          onChange={setSidebarSide}
        />
      </TweakSection>
    </div>
  );
}
```

### Step 9.5: Verify

```bash
pnpm dev
# - Click "Ajustes" en la Sidebar → aparece popover.
# - Cambiar modo a 'dark' → toda la app se oscurece sin reload.
# - Cambiar accent a 'violet' → StatusBar, burbujas user y stripe activa cambian.
# - Cambiar densidad → sidebar y rows cambian de tamaño.
# - Cambiar sidebarSide → la sidebar salta al otro lado.
# - Reabrir app → todos los tweaks persisten.
```

Commit as `feat(tweaks): runtime theme/density/accent/side popover`.

---

## Task 10: Hotkey ⌘, + Esc

**Files:**
- Create: `src/renderer/src/shortcuts/useGlobalShortcuts.ts`
- Modify: `src/renderer/src/App.tsx`

### Step 10.1: `useGlobalShortcuts.ts`

```ts
import { useEffect } from 'react';

export interface ShortcutHandlers {
  onToggleTweaks?: () => void;
  onEscape?: () => void;
  onNewWorktree?: () => void;
}

export function useGlobalShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === ',') {
        e.preventDefault();
        handlers.onToggleTweaks?.();
      } else if (mod && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        handlers.onNewWorktree?.();
      } else if (e.key === 'Escape') {
        handlers.onEscape?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers]);
}
```

> El listener `⌘T` para nueva sesión ya existe en `useSessionHotkey.ts` (Fase 4). No duplicar.

### Step 10.2: Wire en `App.tsx`

```tsx
const [tweaksOpen, setTweaksOpen] = useState(false);

useGlobalShortcuts({
  onToggleTweaks: () => setTweaksOpen((v) => !v),
  onNewWorktree: () => { if (activeProject) setDialogOpenFor(activeProject.id); },
  onEscape: () => {
    if (dialogOpenFor) setDialogOpenFor(null);
    if (tweaksOpen) setTweaksOpen(false);
  },
});
```

> Esto implica subir el state de `tweaksOpen` de `Sidebar` a `App`, y pasar `tweaksOpen`/`setTweaksOpen` a `Sidebar`. Aceptable porque la hotkey es global.

### Step 10.3: Verify

```bash
pnpm dev
# - ⌘, abre/cierra Tweaks.
# - Esc cierra Tweaks o NewWorktreeDialog si está abierto.
# - ⌘N abre NewWorktreeDialog.
```

Commit as `feat(shortcuts): global keymap for tweaks toggle and esc`.

---

## Task 11: E2E tests + theme probe helper

**Files:**
- Create: `tests/e2e/helpers/theme-probe.ts`
- Create: `tests/e2e/shell.spec.ts`
- Create: `tests/e2e/theme.spec.ts`
- Create: `tests/e2e/sidebar-side.spec.ts`

### Step 11.1: `theme-probe.ts`

```ts
import type { Page } from 'playwright';

export interface ThemeProbeSnapshot {
  sidebarBg: string;
  tabbarBg: string;
  statusBarBg: string;
  topChromeBg: string;
  userBubbleBg: string;
}

/** Reads computed bg colors at the canonical points of the shell. */
export async function themeProbe(page: Page): Promise<ThemeProbeSnapshot> {
  return page.evaluate(() => {
    const get = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return '';
      return window.getComputedStyle(el).backgroundColor;
    };
    return {
      sidebarBg: get('[data-testid="sidebar"]'),
      tabbarBg: get('[data-testid="tab-bar"]'),
      statusBarBg: get('[data-testid="status-bar"]'),
      topChromeBg: get('[data-testid="top-chrome"]'),
      userBubbleBg: get('[data-testid="user-message"]'),
    };
  });
}

/** Helper to set a setting via the renderer-exposed API. */
export async function setTweak(page: Page, key: string, value: unknown): Promise<void> {
  await page.evaluate(
    ({ k, v }) => (window as unknown as { jide: { settings: { set: (k: string, v: unknown) => Promise<void> } } }).jide.settings.set(k, v),
    { k: key, v: value },
  );
}

export function rgbHex(rgb: string): string {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return '';
  return '#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0').toUpperCase()).join('');
}
```

### Step 11.2: `shell.spec.ts`

```ts
import { test, expect } from '@playwright/test';
import { launchJide } from './helpers/launch';

test('shell renders top chrome, tab bar (empty), sidebar and status bar', async () => {
  const app = await launchJide();
  const window = await app.firstWindow();
  await expect(window.getByTestId('top-chrome')).toBeVisible();
  await expect(window.getByTestId('sidebar')).toBeVisible();
  await expect(window.getByTestId('status-bar')).toBeVisible();
  // Tab bar exists but empty until the user opens a worktree.
  await expect(window.getByTestId('tab-bar')).toBeVisible();
  await app.close();
});
```

### Step 11.3: `theme.spec.ts`

```ts
import { test, expect } from '@playwright/test';
import { launchJide } from './helpers/launch';
import { themeProbe, rgbHex, setTweak } from './helpers/theme-probe';

test('light theme paints expected token colors', async () => {
  const app = await launchJide();
  const window = await app.firstWindow();
  await setTweak(window, 'theme', 'light');
  await window.waitForTimeout(50);
  const snap = await themeProbe(window);
  expect(rgbHex(snap.sidebarBg)).toBe('#F8F6F2');
  expect(rgbHex(snap.tabbarBg)).toBe('#F2EFEA');
  expect(rgbHex(snap.statusBarBg)).toBe('#F95A5C'); // coral default
  await app.close();
});

test('dark theme swaps surfaces but keeps accent', async () => {
  const app = await launchJide();
  const window = await app.firstWindow();
  await setTweak(window, 'theme', 'dark');
  await window.waitForTimeout(50);
  const snap = await themeProbe(window);
  expect(rgbHex(snap.sidebarBg)).toBe('#121116');
  expect(rgbHex(snap.tabbarBg)).toBe('#0F0E12');
  expect(rgbHex(snap.statusBarBg)).toBe('#F95A5C');
  await app.close();
});

test('accent swap repaints status bar', async () => {
  const app = await launchJide();
  const window = await app.firstWindow();
  await setTweak(window, 'theme', 'light');
  await setTweak(window, 'accent', 'violet');
  await window.waitForTimeout(50);
  const snap = await themeProbe(window);
  expect(rgbHex(snap.statusBarBg)).toBe('#7C67F7');
  await app.close();
});
```

### Step 11.4: `sidebar-side.spec.ts`

```ts
import { test, expect } from '@playwright/test';
import { launchJide } from './helpers/launch';
import { setTweak } from './helpers/theme-probe';

test('sidebar can move to the right', async () => {
  const app = await launchJide();
  const window = await app.firstWindow();
  const sidebar = window.getByTestId('sidebar');
  const initialBox = await sidebar.boundingBox();
  await setTweak(window, 'sidebarSide', 'right');
  await window.waitForTimeout(50);
  const newBox = await sidebar.boundingBox();
  expect(newBox).not.toBeNull();
  expect(initialBox).not.toBeNull();
  // After flipping side, the sidebar's left edge should be > original (was at 0).
  expect((newBox!.x)).toBeGreaterThan(initialBox!.x);
  await app.close();
});
```

### Step 11.5: Verify

```bash
pnpm test:e2e -- tests/e2e/shell.spec.ts tests/e2e/theme.spec.ts tests/e2e/sidebar-side.spec.ts
pnpm test:e2e   # full suite — verificar que nada existente se rompió
```

Commit as `test(shell): e2e for tab bar, theme tokens and sidebar side`.

---

## Task 12: Animations — extend `styles.css` and wire pulse to `StatusDot` running

**Files:**
- Modify: `src/renderer/src/styles.css`
- Modify: `src/renderer/src/components/icons/StatusDot.tsx`

### Step 12.1: `styles.css`

Las keyframes ya están del Step 2.5. Confirmar que `jidePulse` usa `var(--jide-accent)`. Si falta el blink cursor para `StreamingIndicator`, ya está añadida.

### Step 12.2: `StatusDot.tsx`

```tsx
import { useTheme } from '../../theme/useTheme';

type DotState = 'idle' | 'running' | 'awaiting' | 'error' | 'done' | 'exited';

export function StatusDot({ state, size = 8 }: { state: DotState; size?: number }) {
  const { theme, accent } = useTheme();
  const palette: Record<DotState, string> = {
    idle:     theme.textLow,
    running:  accent.value,
    awaiting: theme.warning,
    error:    theme.error,
    done:     theme.success,
    exited:   theme.textDisabled,
  };
  const color = palette[state];
  return (
    <span
      aria-label={`status-${state}`}
      style={{
        width: size, height: size, borderRadius: 999, background: color,
        display: 'inline-block', flexShrink: 0,
        animation: state === 'running' ? 'jidePulse 1.6s ease-out infinite' : undefined,
      }}
    />
  );
}
```

### Step 12.3: Verify

```bash
pnpm dev
# - Forzar una sesión a 'running' → el dot pulsa con el accent activo.
# - Cambiar accent en Tweaks → el halo del pulso cambia de color.
```

Commit as `feat(animations): wire status dot pulse to current accent`.

---

## Task 13: Final integration sweep + drift guards

**Files:**
- Modify: any leftover component still using hardcoded colors.
- Modify: `tests/unit/shared/ipc.test.ts` if relevant (no IPC drift expected — Fase 5 no añade canales).

### Step 13.1: Audit pass

```bash
rg -nP '#[0-9A-Fa-f]{3,8}\b' src/renderer/src --type-add 'react:*.tsx' -t react -t ts | rg -v 'theme/tokens.ts|theme/ThemeProvider.tsx|styles.css|JIcon.tsx'
```

Resultado esperado: `0 matches` (salvo `#FFFFFF` intencional sobre accent, que se acepta — anotar línea por línea). Si quedan, sustituir o documentar excepción inline en el commit body.

### Step 13.2: Drift guard — `tests/unit/shared/settings.test.ts`

Confirmar que el test añade asserts para que un futuro reordenamiento de `DEFAULT_SETTINGS` no rompa la app silenciosamente.

### Step 13.3: Smoke full

```bash
pnpm tsc --noEmit
pnpm lint
pnpm test          # vitest unit suite
pnpm test:e2e      # Playwright
pnpm build         # asegurar que packaging no rompe
```

Commit as `chore(theme): final pass — purge residual hardcoded colors`.

---

## Definition of Done (verificación final)

- [ ] **Mock fidelity:** Side-by-side con `design/project/jide/` en `comfy + light + coral + left` — indistinguible al 1× zoom (mod contenido dinámico). Marcar diferencias menores como aceptables si están documentadas.
- [ ] `⌘,` o click en "Ajustes" abre el Tweaks popover.
- [ ] Cambiar modo `light → dark → auto` no requiere reload; `auto` reacciona a `prefers-color-scheme` del SO en vivo.
- [ ] Cambiar accent (4 opciones) actualiza la banda inferior, las burbujas user, el stripe de la tab activa y el pulse del status dot.
- [ ] Cambiar densidad (`compact ↔ comfy`) cambia ancho de sidebar, altura de tabs y rows.
- [ ] Cambiar `sidebarSide` mueve la sidebar al otro lado y reordena el padding del top chrome.
- [ ] Tabs persistentes: abrir 3 worktrees → cerrar y reabrir la app → las 3 tabs vuelven con el mismo activo.
- [ ] Cerrar la tab activa selecciona la última remanente.
- [ ] Tabs huérfanas (worktrees ya inexistentes) se filtran al hidratar sin crashear.
- [ ] La ventana se puede arrastrar desde el TopChromeStrip.
- [ ] El botón ⌘K del TopChrome es visible pero su click solo loguea (palette pending Fase 8).
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` y `pnpm build` pasan todos.
- [ ] Audit `rg '#[0-9A-Fa-f]{6}'` en `src/renderer/src` excluyendo `tokens.ts`, `ThemeProvider.tsx`, `styles.css` y `JIcon.tsx` da 0 hits no documentados.

---

## Hand-off a Fase 6

- El layout ya soporta partir el `<main>` en filas/columnas (sus hijos pueden añadir un split panel). El `flexDirection` de la zona interna queda gestionado dentro de `<main>`, por lo que Fase 6 sustituye el `<ChatPanel />` actual por un contenedor `<ChatTerminalSplit />` sin tocar `App.tsx`.
- `ThemeProvider` ya expone `theme` y `accent` — los nuevos componentes Terminal/xterm leerán los colores de ahí (no del DOM ni de la CSS var).
- `useGlobalShortcuts` está listo para extenderse con `⌘\` (toggle terminal). Solo añadir handler en Fase 6.
- `StatusBar` deja huecos a la derecha para los botones Term/Visor/Comandos que Fases 6/7/8 reactivarán.

---

## Riesgos abiertos

- **Iconos faltantes:** El set actual (`JIcon.tsx`) cubre ~9 nombres. La StatusBar y el TopChrome necesitan ~7 más. Si la traducción de paths del mock (`design/project/jide/icons.jsx` si existe) sale tosca, aceptable; los iconos pueden refinarse en Fase 9 (polish).
- **`useLayoutEffect` durante popover reposition:** Si la sidebar se redimensiona mientras el popover está abierto, el `getBoundingClientRect()` se queda obsoleto. Mitigación: re-anclar en `resize` listener. Aceptable rendir esto como bug menor pendiente — el popover se cierra al hacer click fuera, así que el caso es raro en práctica.
- **`-webkit-app-region: drag` y formularios:** Los inputs dentro de la región drag son inertes. Por eso el `PaletteButton` y el breadcrumb llevan `no-drag` explícito. Si algún sub-elemento del breadcrumb (badge naranja) atrapa clicks que debían arrastrar la ventana, marcar también `no-drag` selectivo.
- **Migración silenciosa de `electron-store`:** Si un usuario tenía store de Fase 4, los nuevos campos (`density`, `accent`, `sidebarSide`, `openTabs`) aparecerán con defaults. Verificar en QA local borrando solo `theme` para comprobar.
