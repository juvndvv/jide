# Fase 1 — App Skeleton (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar un Electron app vacío pero pulido en producción: ventana arranca, React + TS + Vite hot-reload, IPC tipado main↔renderer, persistencia con electron-store, tests Vitest + Playwright corren localmente y en CI.

**Architecture:** Monorepo simple, no workspaces. `electron-vite` orquesta tres bundles (main / preload / renderer). El renderer es una SPA React 19 con TypeScript strict. IPC pasa por un puente expuesto en preload con `contextBridge.exposeInMainWorld('jide', api)` — tipos compartidos en `src/shared/ipc.ts` garantizan que main, preload y renderer hablan el mismo lenguaje. Persistencia local con `electron-store` (v10, ESM nativo). Tests: Vitest para unit, Playwright (modo Electron) para E2E. CI en GitHub Actions corre typecheck/lint/test en push.

**Tech Stack:** Electron 35, electron-vite 3, React 19, TypeScript 5.7, Vite 6, Vitest 3, Playwright 1.50, electron-store 10, electron-builder 25, pnpm, ESLint 9, Prettier 3.

---

## File structure (final, end-of-phase)

```
jide/
├── .editorconfig
├── .gitignore
├── .npmrc                            # pnpm config (node-linker=hoisted, engine-strict)
├── .prettierrc.json
├── .prettierignore
├── README.md
├── eslint.config.js                  # ESLint flat config (typed linting scoped a src/** y tests/**)
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json                     # base shared
├── tsconfig.node.json                # configs/build scripts (NodeNext + allowJs)
├── tsconfig.web.json                 # renderer (DOM lib)
├── electron.vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── .github/workflows/ci.yml
├── src/
│   ├── main/
│   │   ├── index.ts                  # entry: app.whenReady → createStore → registerHandlers → createWindow
│   │   ├── window.ts                 # createMainWindow()
│   │   ├── ipc/
│   │   │   ├── index.ts              # registerAllHandlers(store)
│   │   │   ├── register.ts           # createHandler() helper tipado
│   │   │   ├── ping.ts               # canal demo
│   │   │   └── settings.ts           # canales settings:get / settings:set
│   │   └── store/
│   │       └── index.ts              # createStore() con esquema tipado
│   ├── preload/
│   │   └── index.ts                  # contextBridge.exposeInMainWorld('jide', api)
│   ├── renderer/
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx              # ReactDOM.createRoot
│   │       ├── App.tsx               # wordmark + theme-toggle demo
│   │       └── styles.css            # reset + background del mock (#F0EEE9)
│   └── shared/
│       ├── ipc.ts                    # tipos de canales (Channel, Req<C>, Res<C>)
│       └── settings.ts               # SettingsSchema, DEFAULTS
└── tests/
    ├── unit/
    │   ├── shared/
    │   │   └── ipc.test.ts
    │   ├── main/
    │   │   ├── ipc/
    │   │   │   └── register.test.ts
    │   │   └── store/
    │   │       └── store.test.ts
    │   └── helpers/
    │       └── tmp-store.ts          # genera ruta tmp para tests de store
    └── e2e/
        ├── smoke.spec.ts             # boot + wordmark
        ├── ipc.spec.ts               # ping/pong + settings roundtrip
        └── helpers/
            └── launch.ts             # launchElectron() reutilizable
```

**Responsabilidades clave:**
- `src/shared/ipc.ts` — única fuente de verdad para canales y sus tipos. Cambiar aquí rompe build en main, preload y renderer simultáneamente (lo cual es bueno).
- `src/main/ipc/register.ts` — helper que envuelve `ipcMain.handle` con tipos para evitar `any` en handlers.
- `src/preload/index.ts` — *único* lugar donde se hace `ipcRenderer.invoke`. El renderer nunca toca Electron directamente.
- `src/main/store/index.ts` — abstracción sobre electron-store con esquema tipado; el resto del main process no importa `electron-store` directamente.

---

## Conventional Commits — recordatorio

Todos los commits de este plan siguen la convención del repo (ver `~/.claude/CLAUDE.md` del usuario):

```
type(scope): short description in imperative mood

Optional body explaining the why (English — per CLAUDE.md policy for all
code, comments, docs, commits and tests).

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
```

No usar `Co-Authored-By`. No incluir trailer `Task:` (esta rama no tiene ID Asana).

---

## Task 1: Bootstrap del repo

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.npmrc`
- Create: `.editorconfig`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `eslint.config.js`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `tsconfig.web.json`
- Create: `electron.vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`

- [ ] **Step 1.1: Crear `package.json`**

```json
{
  "name": "jide",
  "version": "0.1.0",
  "private": true,
  "description": "Command center for Claude Code",
  "author": "Juan Daniel Forner Garriga <dani@jotade.io>",
  "main": "out/main/index.js",
  "type": "module",
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.web.json && tsc --noEmit -p tsconfig.node.json",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "pnpm build && playwright test",
    "verify": "pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm test:e2e"
  },
  "dependencies": {
    "electron-store": "^10.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "electron": "^35.0.0",
    "electron-vite": "^3.0.0",
    "eslint": "^9.0.0",
    "eslint-plugin-react": "^7.37.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "playwright": "^1.50.0",
    "prettier": "^3.4.0",
    "typescript": "^5.7.0",
    "typescript-eslint": "^8.0.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

Notas:
- Script `verify` (no `ci`) — `pnpm ci` es un builtin de pnpm (clean-install). El nombre `verify` evita la colisión.
- `engines` + `engine-strict=true` (en `.npmrc`) garantiza Node 22+ (requerido por `import.meta.dirname` y resolvers modernos).

- [ ] **Step 1.2: Crear `.gitignore`**

```gitignore
node_modules/
out/
dist/
.vite/
*.log
.DS_Store
playwright-report/
test-results/
.env
.env.local
coverage/
.idea/
.vscode/
*.tsbuildinfo
```

- [ ] **Step 1.3: Crear `.npmrc`** (Electron requiere hoisting en pnpm)

```ini
node-linker=hoisted
public-hoist-pattern[]=*electron*
public-hoist-pattern[]=*types*
engine-strict=true
```

- [ ] **Step 1.4: Crear `.editorconfig`**

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 1.5: Crear `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 1.6: Crear `.prettierignore`**

```
node_modules/
out/
dist/
pnpm-lock.yaml
playwright-report/
test-results/
coverage/
design/
.planning/
.DS_Store
```

- [ ] **Step 1.7: Crear `eslint.config.js`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // Files / directories that ESLint must not touch at all.
  {
    ignores: [
      'out/',
      'dist/',
      'node_modules/',
      'coverage/',
      'playwright-report/',
      'design/',
      '.planning/',
    ],
  },
  js.configs.recommended,
  // Root config files use untyped linting — they are not part of any
  // tsconfig project's `include`, so typed linting would fail to parse them.
  {
    files: ['*.config.{ts,js}', 'eslint.config.js'],
    extends: [tseslint.configs.recommended],
  },
  // Typed linting is scoped strictly to source and test trees.
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.web.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    ...react.configs.flat.recommended,
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
    },
    settings: { react: { version: '19' } },
  },
);
```

- [ ] **Step 1.8: Crear `tsconfig.json`** (base compartida)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/main/**/*", "src/preload/**/*", "src/shared/**/*", "tests/**/*"],
  "exclude": ["src/renderer", "node_modules", "out"]
}
```

- [ ] **Step 1.9: Crear `tsconfig.node.json`** (configs y scripts)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "allowImportingTsExtensions": false,
    "allowJs": true,
    "checkJs": false,
    "noEmit": true
  },
  "include": ["electron.vite.config.ts", "vitest.config.ts", "playwright.config.ts", "eslint.config.js"]
}
```

`allowJs: true` + `checkJs: false` permite resolver `eslint.config.js` (un `.js` file) bajo NodeNext sin que se intente typechequear.

- [ ] **Step 1.10: Crear `tsconfig.web.json`** (renderer con DOM)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"],
  "exclude": ["node_modules", "out"]
}
```

- [ ] **Step 1.11: Crear `electron.vite.config.ts`**

```ts
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sharedAlias = { '@shared': resolve(__dirname, 'src/shared') };

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: resolve(__dirname, 'out/main') },
    resolve: { alias: sharedAlias },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: resolve(__dirname, 'out/preload') },
    resolve: { alias: sharedAlias },
  },
  renderer: {
    plugins: [react()],
    root: 'src/renderer',
    build: { outDir: resolve(__dirname, 'out/renderer'), emptyOutDir: true },
    resolve: { alias: sharedAlias },
  },
});
```

Notas sobre el config:
- Todas las `outDir` son rutas absolutas resueltas contra `__dirname` para que sean CWD-independientes. Esto evita el bug por el que la renderer `outDir` relativa terminaba escribiendo fuera del proyecto.
- `preload` se emite como `index.mjs` (default de electron-vite cuando `package.json` tiene `"type": "module"`). Intentar forzar `entryFileNames: '[name].js'` no funciona — el preset interno de electron-vite sobreescribe el output cuando el formato es ESM. La referencia desde `window.ts` debe usar `.mjs`.

- [ ] **Step 1.12: Crear `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/renderer/**', 'src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: { '@shared': resolve('src/shared') },
  },
});
```

- [ ] **Step 1.13: Crear `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
});
```

- [ ] **Step 1.14: Instalar dependencias y verificar baseline verde**

```bash
pnpm install
pnpm lint
pnpm format:check
```

Expected:
- `pnpm install`: sin errores.
- `pnpm lint`: PASS (sin warnings ni errors). El ESLint flat config tiene typed-linting restringido a `src/**` y `tests/**` — los config files de raíz se lintean sin type-checking.
- `pnpm format:check`: PASS. `design/` y `.planning/` están en `.prettierignore`.

NOTA: no corras `pnpm typecheck` aún — los tsconfigs apuntan a `src/main/**`, `src/preload/**`, `src/shared/**` y `tests/**`, y `tsc` emitiría TS18003 por includes vacíos. El typecheck pasa a partir de Task 2 cuando exista código real.

- [ ] **Step 1.15: Init git y commit**

```bash
git add .
git commit -m "$(cat <<'EOF'
chore(setup): bootstrap repo with electron-vite + tooling

Configures Electron 35 + React 19 + TypeScript strict via electron-vite.
Adds Vitest, Playwright (Electron mode), ESLint flat config and Prettier.
pnpm with node-linker=hoisted for Electron compatibility.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 2: Boot del main process con ventana

**Files:**
- Create: `src/main/index.ts`
- Create: `src/main/window.ts`
- Create: `src/preload/index.ts` (vacío de momento, requerido por electron-vite)
- Create: `src/renderer/index.html`
- Create: `tests/e2e/helpers/launch.ts`
- Create: `tests/e2e/smoke.spec.ts`

- [ ] **Step 2.1: Escribir el test E2E que falla**

`tests/e2e/helpers/launch.ts`:

```ts
import { _electron as electron, type ElectronApplication } from 'playwright';
import { resolve } from 'node:path';

export async function launchJide(): Promise<ElectronApplication> {
  return electron.launch({
    args: [resolve(process.cwd(), 'out/main/index.js')],
    env: { ...process.env, NODE_ENV: 'test', ELECTRON_DISABLE_GPU: '1' },
  });
}
```

`tests/e2e/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { launchJide } from './helpers/launch';

test('app boots and opens a window titled "jide"', async () => {
  const app = await launchJide();
  const window = await app.firstWindow();
  await expect(window).toHaveTitle('jide');
  await app.close();
});
```

- [ ] **Step 2.2: Ejecutar el test y ver que falla**

```bash
pnpm test:e2e
```

Expected: FAIL — la build de electron-vite no tiene entradas (no hay `src/`), error tipo `Error: An entry point is required in the electron vite main config`. Documenta el error exacto.

- [ ] **Step 2.3: Implementar `src/renderer/index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'self'" />
    <title>jide</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

CSP nota: `object-src 'none'` y `base-uri 'self'` no caen al `default-src` en todos los parsers, hay que declararlos. `connect-src 'self'` queda preemptivamente para IPC futuro.

- [ ] **Step 2.4: Implementar `src/preload/index.ts`** (stub)

```ts
// IPC bridge between main and renderer. Populated in Task 5.
export {};
```

`export {};` evita que electron-vite reporte `Generated an empty chunk: 'index'` y deja el preload como un ES module explícito.

- [ ] **Step 2.5: Implementar `src/main/window.ts`**

```ts
import { BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'jide',
    backgroundColor: '#F0EEE9',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.once('ready-to-show', () => win.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}
```

`setWindowOpenHandler` deny previene que `target=_blank` / `window.open` desde contenido comprometido hereden nuestras webPreferences.

- [ ] **Step 2.6: Implementar `src/main/index.ts`**

```ts
import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window.js';

void app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

Nota: el `void` prefix evita el lint `@typescript-eslint/no-floating-promises`. Es la forma idiomática cuando el lifecycle de Electron no permite top-level await sin envolverlo.

- [ ] **Step 2.7: Implementar un `src/renderer/src/main.tsx` mínimo** (para que la build no rompa)

```tsx
const root = document.getElementById('root');
if (root) root.textContent = 'jide';
```

- [ ] **Step 2.8: Build y correr E2E**

```bash
pnpm test:e2e
```

Expected: PASS — la ventana abre y su título es `jide`.

- [ ] **Step 2.9: Commit**

```bash
git add .
git commit -m "$(cat <<'EOF'
feat(main): boot Electron main process with hidden-inset window

Loads renderer in dev (ELECTRON_RENDERER_URL) or production (file://).
preload stub ready for Task 5. E2E smoke verifies boot.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 3: Renderer con React + wordmark "jide"

**Files:**
- Modify: `src/renderer/src/main.tsx`
- Create: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/styles.css`
- Modify: `tests/e2e/smoke.spec.ts`

- [ ] **Step 3.1: Ampliar el test E2E con el wordmark**

Sustituye `tests/e2e/smoke.spec.ts` por:

```ts
import { test, expect } from '@playwright/test';
import { launchJide } from './helpers/launch';

test('app boots and opens a window titled "jide"', async () => {
  const app = await launchJide();
  const window = await app.firstWindow();
  await expect(window).toHaveTitle('jide');
  await app.close();
});

test('renderer shows jide wordmark', async () => {
  const app = await launchJide();
  const window = await app.firstWindow();
  await expect(window.getByTestId('wordmark')).toHaveText('jide');
  await app.close();
});
```

- [ ] **Step 3.2: Ejecutar y ver fallo del segundo test**

```bash
pnpm test:e2e
```

Expected: smoke PASS, wordmark FAIL (`getByTestId('wordmark')` no existe).

- [ ] **Step 3.3: Implementar `src/renderer/src/styles.css`**

```css
:root {
  --jide-bg: #f0eee9;
  --jide-fg: #1f1f1f;
  --jide-accent: #d97757;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  padding: 0;
  height: 100%;
}

body {
  background: var(--jide-bg);
  color: var(--jide-fg);
  font-family: 'Open Sauce One', system-ui, -apple-system, sans-serif;
  overflow: hidden;
}
```

- [ ] **Step 3.4: Implementar `src/renderer/src/App.tsx`**

```tsx
export function App() {
  return (
    <main
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <h1
        data-testid="wordmark"
        style={{
          fontFamily: '"Bowlby One SC", Anton, Impact, sans-serif',
          fontSize: 96,
          letterSpacing: -2,
          color: 'var(--jide-accent)',
          margin: 0,
        }}
      >
        jide
      </h1>
    </main>
  );
}
```

- [ ] **Step 3.5: Reemplazar `src/renderer/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 3.6: Correr typecheck + E2E**

```bash
pnpm typecheck && pnpm test:e2e
```

Expected: typecheck PASS, ambos E2E PASS.

- [ ] **Step 3.7: Commit**

```bash
git add .
git commit -m "$(cat <<'EOF'
feat(renderer): render jide wordmark with React 19

App.tsx renders the wordmark in Bowlby One on the mock background.
StrictMode enabled in development.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 4: Tipos compartidos para IPC

**Files:**
- Create: `src/shared/ipc.ts`
- Create: `src/shared/settings.ts`
- Create: `tests/unit/shared/ipc.test.ts`

- [ ] **Step 4.1: Escribir test unitario que falla**

`tests/unit/shared/ipc.test.ts`:

```ts
import { describe, it, expect, expectTypeOf } from 'vitest';
import type { Channel, ChannelMap, JideApi, Req, Res } from '@shared/ipc';
import { CHANNELS } from '@shared/ipc';
import type { SettingsSchema, ThemeMode } from '@shared/settings';

describe('shared/ipc — runtime', () => {
  it('freezes CHANNELS and includes all expected entries', () => {
    expect(Object.isFrozen(CHANNELS)).toBe(true);
    expect(CHANNELS).toContain('ping');
    expect(CHANNELS).toContain('settings:get');
    expect(CHANNELS).toContain('settings:set');
  });

  it('CHANNELS keys match the runtime keys we use across the app', () => {
    expect([...CHANNELS].sort()).toEqual(['ping', 'settings:get', 'settings:set']);
  });
});

describe('shared/ipc — type contract', () => {
  it('ping: request is void, response is string', () => {
    expectTypeOf<Req<'ping'>>().toEqualTypeOf<void>();
    expectTypeOf<Res<'ping'>>().toEqualTypeOf<string>();
  });

  it('settings:get: request is a keyed lookup', () => {
    expectTypeOf<Req<'settings:get'>>().toEqualTypeOf<{ key: 'theme' | 'lastWorktreeId' }>();
  });

  it('settings:get: response is the union over all setting value types', () => {
    expectTypeOf<Res<'settings:get'>>().toEqualTypeOf<SettingsSchema[keyof SettingsSchema]>();
  });

  it('CHANNELS covers every key in ChannelMap (drift guard)', () => {
    expectTypeOf<(typeof CHANNELS)[number]>().toEqualTypeOf<keyof ChannelMap>();
  });

  it('Channel union equals keyof ChannelMap', () => {
    expectTypeOf<Channel>().toEqualTypeOf<keyof ChannelMap>();
  });
});

describe('shared/ipc — settings:set discriminated payload', () => {
  it('matches key with value (positive)', () => {
    expectTypeOf<Req<'settings:set'>>().toEqualTypeOf<
      | { key: 'theme'; value: ThemeMode }
      | { key: 'lastWorktreeId'; value: string | null }
    >();
  });

  it('rejects cross-key value contamination', () => {
    // @ts-expect-error theme cannot accept null (it is required ThemeMode)
    const a: Req<'settings:set'> = { key: 'theme', value: null };
    // @ts-expect-error theme cannot accept arbitrary strings
    const b: Req<'settings:set'> = { key: 'theme', value: 'not-a-theme' };
    // @ts-expect-error lastWorktreeId must be string|null, not a number
    const c: Req<'settings:set'> = { key: 'lastWorktreeId', value: 123 };
    void a;
    void b;
    void c;
  });
});

describe('shared/ipc — JideApi precision', () => {
  it('settings.get returns a precise type per key', () => {
    const get = (() => Promise.resolve('auto')) as JideApi['settings']['get'];
    expectTypeOf(get('theme')).toEqualTypeOf<Promise<ThemeMode>>();
    expectTypeOf(get('lastWorktreeId')).toEqualTypeOf<Promise<string | null>>();
  });

  it('ping returns Promise<string>', () => {
    expectTypeOf<ReturnType<JideApi['ping']>>().toEqualTypeOf<Promise<string>>();
  });
});
```

- [ ] **Step 4.2: Ejecutar y ver el fallo**

```bash
pnpm test
```

Expected: FAIL — `Cannot find module '@shared/ipc'`.

- [ ] **Step 4.3: Implementar `src/shared/settings.ts`**

```ts
export type ThemeMode = 'light' | 'dark' | 'auto';

export interface SettingsSchema {
  theme: ThemeMode;
  lastWorktreeId: string | null;
}

export const DEFAULT_SETTINGS: SettingsSchema = {
  theme: 'auto',
  lastWorktreeId: null,
};

export type SettingsKey = keyof SettingsSchema;
```

- [ ] **Step 4.4: Implementar `src/shared/ipc.ts`**

```ts
import type { SettingsKey, SettingsSchema } from './settings.js';

export const CHANNELS = ['ping', 'settings:get', 'settings:set'] as const;
export type Channel = (typeof CHANNELS)[number];

export type ChannelMap = {
  ping: { req: void; res: string };
  'settings:get': {
    req: { key: SettingsKey };
    res: SettingsSchema[SettingsKey];
  };
  'settings:set': {
    req: { [K in SettingsKey]: { key: K; value: SettingsSchema[K] } }[SettingsKey];
    res: void;
  };
};

export type Req<C extends Channel> = ChannelMap[C]['req'];
export type Res<C extends Channel> = ChannelMap[C]['res'];

export interface JideApi {
  ping: () => Promise<string>;
  settings: {
    get: <K extends SettingsKey>(key: K) => Promise<SettingsSchema[K]>;
    set: <K extends SettingsKey>(key: K, value: SettingsSchema[K]) => Promise<void>;
  };
}

declare global {
  interface Window {
    jide: JideApi;
  }
}

// runtime: freeze to prevent accidental mutation
Object.freeze(CHANNELS);
```

`ChannelMap` es `type` (no `interface`) para evitar declaration merging — el registry es cerrado por diseño.

- [ ] **Step 4.5: Verificar tests + typecheck**

```bash
pnpm test && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4.6: Commit**

```bash
git add .
git commit -m "$(cat <<'EOF'
feat(ipc): shared channel types for main↔renderer bridge

Define CHANNELS readonly tuple, discriminated ChannelMap, helpers Req<C>/Res<C>,
and the JideApi interface exposed at window.jide. Settings schema with strict
types over theme and lastWorktreeId.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 5: Puente IPC tipado (preload + main register + ping)

**Files:**
- Create: `src/main/ipc/register.ts`
- Create: `src/main/ipc/ping.ts`
- Create: `src/main/ipc/index.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Create: `tests/unit/main/ipc/register.test.ts`
- Create: `tests/e2e/ipc.spec.ts`

- [ ] **Step 5.1: Escribir test unitario para `register.ts` (que falla)**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHandler } from '../../../../src/main/ipc/register';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

describe('createHandler', () => {
  beforeEach(async () => {
    const { ipcMain } = await import('electron');
    (ipcMain.handle as ReturnType<typeof vi.fn>).mockClear();
  });

  it('registers an ipcMain handler for the given channel', async () => {
    const { ipcMain } = await import('electron');
    createHandler('ping', () => Promise.resolve('pong'));
    expect(ipcMain.handle).toHaveBeenCalledWith('ping', expect.any(Function));
  });

  it('passes through the handler return value', async () => {
    const { ipcMain } = await import('electron');
    createHandler('ping', () => Promise.resolve('pong'));
    const [, wrapped] = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls[0];
    const result = await wrapped({} as unknown);
    expect(result).toBe('pong');
  });
});
```

Nota: si el lint typed reclama por `unbound-method` o `no-unsafe-*`, usa el patrón `vi.hoisted` con un mock tipado (`Mock<HandleFn>`) — el contrato a verificar (handler registrado + return value pasa) debe preservarse.

- [ ] **Step 5.2: Escribir test E2E para `window.jide.ping()` (que falla)**

`tests/e2e/ipc.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { launchJide } from './helpers/launch';

test('window.jide.ping() returns "pong"', async () => {
  const app = await launchJide();
  const page = await app.firstWindow();
  const result = await page.evaluate(() => window.jide.ping());
  expect(result).toBe('pong');
  await app.close();
});
```

Nota: la variable local se llama `page` (no `window`) porque el `window` de Playwright es un `Page` que no tiene `jide`. Dentro del callback de `evaluate`, `window.jide` se resuelve contra el browser global gracias al `declare global` en `src/shared/ipc.ts`.

- [ ] **Step 5.3: Correr ambos tests y verificar fallo**

```bash
pnpm test && pnpm test:e2e
```

Expected: ambos FAIL — `register` no existe, `window.jide` undefined.

- [ ] **Step 5.4: Implementar `src/main/ipc/register.ts`**

```ts
import { ipcMain } from 'electron';
import type { Channel, Req, Res } from '@shared/ipc';

export type Handler<C extends Channel> = (payload: Req<C>) => Promise<Res<C>>;

export function createHandler<C extends Channel>(channel: C, handler: Handler<C>): void {
  ipcMain.handle(channel, async (_event, payload: Req<C>) => handler(payload));
}
```

- [ ] **Step 5.5: Implementar `src/main/ipc/ping.ts`**

```ts
import { createHandler } from './register.js';

export function registerPing(): void {
  createHandler('ping', () => Promise.resolve('pong'));
}
```

- [ ] **Step 5.6: Implementar `src/main/ipc/index.ts`** (será modificado en Task 7 para aceptar store)

```ts
import { registerPing } from './ping.js';

export function registerAllHandlers(): void {
  registerPing();
}
```

- [ ] **Step 5.7: Modificar `src/main/index.ts`**

```ts
import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window.js';
import { registerAllHandlers } from './ipc/index.js';

void app.whenReady().then(() => {
  registerAllHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 5.8: Implementar `src/preload/index.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron';
import type { JideApi } from '@shared/ipc';
import type { SettingsKey, SettingsSchema } from '@shared/settings';

// Trust model: `ipcRenderer.invoke` returns `Promise<unknown>`. The casts below
// rely on `createHandler<C>` in main enforcing the response type at the IPC
// boundary. Do not introduce a generic `invoke(channel)` helper here — keep
// the per-method shape so the renderer surface stays minimal and auditable.
const api: JideApi = {
  ping: () => ipcRenderer.invoke('ping') as Promise<string>,
  settings: {
    get: <K extends SettingsKey>(key: K): Promise<SettingsSchema[K]> =>
      ipcRenderer.invoke('settings:get', { key }) as Promise<SettingsSchema[K]>,
    set: <K extends SettingsKey>(key: K, value: SettingsSchema[K]): Promise<void> =>
      ipcRenderer.invoke('settings:set', { key, value }) as Promise<void>,
  },
};

contextBridge.exposeInMainWorld('jide', api);
```

- [ ] **Step 5.9: Correr typecheck, unit y E2E**

```bash
pnpm typecheck && pnpm test && pnpm test:e2e
```

Expected: todos PASS.

- [ ] **Step 5.10: Commit**

```bash
git add .
git commit -m "$(cat <<'EOF'
feat(ipc): typed main↔renderer bridge with ping channel

Add createHandler() in main, wrapping ipcMain.handle with the @shared/ipc
types. preload exposes window.jide via contextBridge. Ping channel
verified end-to-end with Playwright.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 6: Wrapper de electron-store con esquema tipado

**Files:**
- Create: `src/main/store/index.ts`
- Create: `tests/unit/main/store/store.test.ts`
- Create: `tests/unit/helpers/tmp-store.ts`

- [ ] **Step 6.1: Crear helper para tests** (`tests/unit/helpers/tmp-store.ts`)

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function tmpStoreDir(): { cwd: string; cleanup: () => void } {
  const cwd = mkdtempSync(join(tmpdir(), 'jide-store-'));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}
```

- [ ] **Step 6.2: Escribir test unitario que falla**

`tests/unit/main/store/store.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createStore } from '../../../../src/main/store/index';
import { DEFAULT_SETTINGS } from '@shared/settings';
import { tmpStoreDir } from '../../helpers/tmp-store';

describe('createStore', () => {
  let cwd: string;
  let cleanup: () => void;

  beforeEach(() => {
    ({ cwd, cleanup } = tmpStoreDir());
  });
  afterEach(() => cleanup());

  it('returns the default value when a key is unset', () => {
    const store = createStore({ cwd });
    expect(store.get('theme')).toBe(DEFAULT_SETTINGS.theme);
  });

  it('persists a written value across instances', () => {
    const a = createStore({ cwd });
    a.set('theme', 'dark');
    const b = createStore({ cwd });
    expect(b.get('theme')).toBe('dark');
  });

  it('persists null for lastWorktreeId by default', () => {
    const store = createStore({ cwd });
    expect(store.get('lastWorktreeId')).toBeNull();
    store.set('lastWorktreeId', 'wt-1');
    expect(store.get('lastWorktreeId')).toBe('wt-1');
  });
});
```

- [ ] **Step 6.3: Correr y ver fallo**

```bash
pnpm test
```

Expected: FAIL — `Cannot find module '../../../../src/main/store/index'`.

- [ ] **Step 6.4: Implementar `src/main/store/index.ts`**

```ts
import Store from 'electron-store';
import { DEFAULT_SETTINGS, type SettingsKey, type SettingsSchema } from '@shared/settings';

export interface CreateStoreOptions {
  cwd?: string;
  name?: string;
}

export interface JideStore {
  get: <K extends SettingsKey>(key: K) => SettingsSchema[K];
  set: <K extends SettingsKey>(key: K, value: SettingsSchema[K]) => void;
}

export function createStore(options: CreateStoreOptions = {}): JideStore {
  const inner = new Store<SettingsSchema>({
    name: options.name ?? 'settings',
    cwd: options.cwd,
    defaults: DEFAULT_SETTINGS,
  });

  return {
    get: (key) => inner.get(key),
    set: (key, value) => inner.set(key, value),
  };
}
```

- [ ] **Step 6.5: Correr tests**

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 6.6: Commit**

```bash
git add .
git commit -m "$(cat <<'EOF'
feat(store): typed electron-store wrapper with defaults

createStore() returns a typed facade over electron-store. Accepts an
injectable cwd for tests; uses DEFAULT_SETTINGS as the base schema.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 7: Canales IPC de settings + demo en renderer

**Files:**
- Create: `src/main/ipc/settings.ts`
- Modify: `src/main/ipc/index.ts`
- Modify: `src/main/index.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `tests/e2e/ipc.spec.ts`

- [ ] **Step 7.1: Escribir test E2E del roundtrip**

Añade al final de `tests/e2e/ipc.spec.ts`:

```ts
test('settings: write then read returns the same value', async () => {
  const app = await launchJide();
  const page = await app.firstWindow();

  const before = await page.evaluate(() => window.jide.settings.get('theme'));
  expect(['auto', 'light', 'dark']).toContain(before);

  await page.evaluate(() => window.jide.settings.set('theme', 'dark'));
  const after = await page.evaluate(() => window.jide.settings.get('theme'));
  expect(after).toBe('dark');

  await app.close();
});
```

- [ ] **Step 7.2: Ejecutar y ver fallo**

```bash
pnpm test:e2e
```

Expected: el nuevo test FAIL (`Error: No handler registered for 'settings:get'`).

- [ ] **Step 7.3: Implementar `src/main/ipc/settings.ts`**

```ts
import { createHandler } from './register.js';
import type { JideStore } from '../store/index.js';

export function registerSettings(store: JideStore): void {
  createHandler('settings:get', ({ key }) => Promise.resolve(store.get(key)));
  createHandler('settings:set', ({ key, value }) => {
    store.set(key, value);
    return Promise.resolve();
  });
}
```

- [ ] **Step 7.4: Modificar `src/main/ipc/index.ts`** para que reciba el store

```ts
import type { JideStore } from '../store/index.js';
import { registerPing } from './ping.js';
import { registerSettings } from './settings.js';

export function registerAllHandlers(store: JideStore): void {
  registerPing();
  registerSettings(store);
}
```

- [ ] **Step 7.5: Modificar `src/main/index.ts`** para crear store y pasarlo

```ts
import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window.js';
import { registerAllHandlers } from './ipc/index.js';
import { createStore } from './store/index.js';

void app.whenReady().then(() => {
  const store = createStore();
  registerAllHandlers(store);
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 7.6: Modificar `src/renderer/src/App.tsx`** para demostrar settings vivo

```tsx
import { useEffect, useState } from 'react';
import type { ThemeMode } from '@shared/settings';

export function App() {
  const [theme, setTheme] = useState<ThemeMode | null>(null);

  useEffect(() => {
    void window.jide.settings.get('theme').then(setTheme);
  }, []);

  // TODO(phase-5): replace this temporary theme-toggle demo with the real Tweaks panel.
  const cycle = async () => {
    const order: ThemeMode[] = ['auto', 'light', 'dark'];
    const next = order[(order.indexOf(theme ?? 'auto') + 1) % order.length] ?? 'auto';
    await window.jide.settings.set('theme', next);
    setTheme(next);
  };

  return (
    <main
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <h1
        data-testid="wordmark"
        style={{
          fontFamily: '"Bowlby One SC", Anton, Impact, sans-serif',
          fontSize: 96,
          letterSpacing: -2,
          color: 'var(--jide-accent)',
          margin: 0,
        }}
      >
        jide
      </h1>
      {/* TODO(phase-5): swap for real Tweaks panel; this button is only here to prove the settings IPC roundtrip works. */}
      <button
        type="button"
        data-testid="theme-toggle"
        onClick={() => void cycle()}
        style={{
          padding: '8px 16px',
          fontFamily: 'inherit',
          borderRadius: 8,
          border: '1px solid #00000020',
          background: '#FFFFFF',
          cursor: 'pointer',
        }}
      >
        theme: <span data-testid="theme-value">{theme ?? '…'}</span>
      </button>
    </main>
  );
}
```

- [ ] **Step 7.7: Verificar todo**

```bash
pnpm typecheck && pnpm test && pnpm test:e2e
```

Expected: PASS en todos.

- [ ] **Step 7.8: Commit**

```bash
git add .
git commit -m "$(cat <<'EOF'
feat(settings): persist user theme via IPC + electron-store

Register settings:get / settings:set channels in main; inject JideStore
into registerAllHandlers. Temporary renderer UI cycles theme and persists
it across reloads.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 8: CI en GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 8.1: Implementar el workflow**

`.github/workflows/ci.yml`:

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Format check
        run: pnpm format:check

      - name: Unit tests
        run: pnpm test

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: E2E tests (xvfb)
        run: xvfb-run --auto-servernum pnpm test:e2e

      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

El workflow llama a cada script individualmente (no `pnpm verify`) para obtener reporting step-by-step en la UI de GH Actions.

- [ ] **Step 8.2: Validar localmente que `pnpm verify` corre todo**

```bash
pnpm verify
```

Expected: typecheck → lint → format:check → test → test:e2e, todos PASS.

- [ ] **Step 8.3: Commit**

```bash
git add .
git commit -m "$(cat <<'EOF'
ci: add github actions workflow for typecheck/lint/test

Runs on push and pull request against main. Uses xvfb for Playwright +
Electron on Ubuntu. Uploads playwright-report as an artifact on failure.

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Task 9: README

**Files:**
- Create: `README.md`

- [ ] **Step 9.1: Escribir `README.md`**

````markdown
# jide

Command center for [Claude Code](https://claude.ai/code) — orchestrates multiple CLI sessions over git worktrees.

> **Status:** Phase 1 (skeleton). The app boots and persists settings, but none of the Claude / git / chat / terminal features exist yet. See `.planning/phases/ROADMAP.md` for what's coming.

## Requirements

- Node.js **22+**
- pnpm **9+**

## Quickstart

```bash
pnpm install
pnpm dev
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Launches Electron with HMR |
| `pnpm build` | Production build into `out/` |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright E2E in Electron mode |
| `pnpm typecheck` | TypeScript across the three tsconfigs |
| `pnpm lint` | ESLint flat config |
| `pnpm verify` | Full local CI chain |

> `pnpm ci` is a pnpm built-in (clean-install). Use `pnpm verify` for the local CI chain.

## Project layout

```
src/
  main/      Electron main process (Node)
  preload/   contextBridge — exposes window.jide
  renderer/  React 19 SPA
  shared/    Types shared across main/preload/renderer
tests/
  unit/      Vitest
  e2e/       Playwright (Electron mode)
.planning/   Implementation plans per phase
```
````

- [ ] **Step 9.2: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: add README with quickstart and scripts

Document local setup, available scripts, repo structure, and the
pnpm verify chain (and its collision with the pnpm ci builtin).

Signed-off-by: Juan Daniel Forner Garriga <dani@jotade.io>
EOF
)"
```

---

## Definition of Done — Fase 1

Al cerrar esta fase debe cumplirse, sin trampas:

- [ ] `pnpm dev` abre una ventana con el wordmark `jide` y HMR funcional en el renderer.
- [ ] `pnpm build && pnpm preview` arranca el build de producción.
- [ ] `pnpm verify` pasa en local (typecheck + lint + format + unit + e2e).
- [ ] GitHub Actions corre verde en `main`.
- [ ] El theme persiste entre reinicios: cambiarlo, cerrar la app, volver a abrirla → sigue el último valor.
- [ ] No existe ningún `any` no marcado en el código (ESLint avisa con `recommendedTypeChecked`).
- [ ] No hay `console.log` perdidos en producción.
- [ ] La rama está limpia (`git status` sin pendientes).

---

## Known issues deferred from review

Items surfaced during code quality review but not blocking subsequent tasks. Address before Phase 5 (design system) so they don't compound.

- **Wordmark fonts (`Bowlby One SC`, `Open Sauce One`) are not bundled.** `App.tsx` and `styles.css` reference fonts that don't exist under `design/project/system/fonts/` (which ships Geist only). Browser silently falls back to Impact/system-ui — the wordmark you see is NOT the wordmark designed. Fix in Phase 5 by either (a) sourcing and adding the fonts with `@font-face`, or (b) replacing the stack with what's actually available.
- **Each Playwright E2E test cold-boots Electron.** Fine at 4 tests; will become ~10s of pure boot overhead per CI run by Task 8. Convert `launchJide` into a Playwright worker-scoped fixture (`test.extend<{ app: ElectronApplication }>` with `scope: 'worker'`) when we hit 5+ specs.
- **`index.html` declares `lang="es"` but content is English.** Cosmetic; revisit when i18n strategy is decided.
- **`createHandler` lacks a rejection-propagation test.** The trivial pass-through is covered; add a test asserting `Promise.reject(new Error('x'))` from a handler reaches `invoke`'s caller as a rejection before Task 7's settings handlers ship (they can fail on disk errors).
- **Preload `as Promise<...>` casts are intentional** — `ipcRenderer.invoke` returns `Promise<unknown>`. Trust model: main enforces the response type via `createHandler<C>`. The comment in `src/preload/index.ts` documents this.
- **Settings handlers lack runtime validation.** `registerSettings` trusts the typed contract but renderer-side TS types vanish at runtime. Before Phase 5 reads `theme` to drive CSS, add a guard (handwritten or `zod`) in `registerSettings` that rejects unknown `theme` values.
- **Theme-toggle UI button is not exercised by E2E.** The settings roundtrip test uses `page.evaluate`, not `getByTestId('theme-toggle').click()`. Add a click test in Phase 5 (or sooner) to exercise the `useEffect` + `useState` reactivity path.
- **Theme-toggle UI in `App.tsx` is temporary.** Phase 5 replaces it with the Tweaks panel. The `TODO(phase-5)` markers in source make this explicit.

---

## Hand-off a Fase 2

La Fase 2 (Proyectos & worktrees) extiende sobre los cimientos puestos aquí:

- `src/shared/ipc.ts` añadirá canales `projects:*` y `worktrees:*` — el drift-guard test obligará a actualizar `CHANNELS` y `ChannelMap` en sincronía.
- `src/main/store/` ampliará el schema con `projects: Project[]`.
- `src/main/git/` será un módulo nuevo con un wrapper sobre `simple-git` o `execa('git', …)`.
- El renderer reemplazará el wordmark central por la Sidebar real del mock.

No tocar `electron.vite.config.ts` ni los tsconfig — están dimensionados para crecer.
