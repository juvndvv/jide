# jide — Roadmap de fases

> **Cómo leer este documento:** cada sección describe el alcance, riesgos y task list de alto nivel de una fase. Los planes ejecutables (TDD paso a paso) viven en `.planning/plans/YYYY-MM-DD-fase-N-*.md` y se escriben **inmediatamente antes** de empezar cada fase, usando como insumo el código real ya construido.
>
> **Fase 1** ya tiene plan completo y está implementada en la rama `feat/fase-1-app-skeleton` (PR #1).

| Fase | Estado | Plan ejecutable |
|---|---|---|
| 1 — App skeleton | ✅ Mergeable (PR #1) | `.planning/plans/2026-05-14-fase-1-app-skeleton.md` |
| 2 — Proyectos & worktrees | 📝 Plan listo | `.planning/plans/2026-05-14-fase-2-proyectos-worktrees.md` |
| 3 — Sesión Claude end-to-end | 🗒 Outline | — |
| 4 — Multi-sesión por worktree | 🗒 Outline | — |
| 5 — Tabs + UI shell | 🗒 Outline | — |
| 6 — Terminal split | 🗒 Outline | — |
| 7 — File viewer + watcher | 🗒 Outline | — |
| 8 — Command palette + atajos | 🗒 Outline | — |
| 9 — Polish & packaging | 🗒 Outline | — |

---

## Fase 2 — Proyectos & worktrees

**Goal:** El usuario puede añadir proyectos locales, ver sus worktrees con estado git real, y crear/eliminar worktrees desde la UI. La Sidebar del mock funciona contra datos reales.

**Riesgo principal:** el wrapper de git es el corazón de toda la app. Si no lo modelamos bien aquí (errores, concurrencia, repos no-git, branches con caracteres raros) lo pagamos en todas las fases siguientes.

**Stack añadido:** `simple-git` ó `execa('git', …)` (decisión abierta — ver más abajo), `chokidar` para detectar cambios externos.

### Nuevos archivos / cambios

```
src/
  main/
    git/
      index.ts                 # GitClient factory por proyecto
      worktree.ts              # add/list/remove/status
      status.ts                # ahead/behind/changes count
      branches.ts              # list local branches (para new-worktree dialog)
    projects/
      index.ts                 # ProjectRegistry: add/list/remove (sobre store)
    ipc/
      projects.ts              # canales projects:*
      worktrees.ts             # canales worktrees:*
  shared/
    project.ts                 # Project, Worktree types
    ipc.ts                     # +channels projects:* y worktrees:*
  renderer/src/
    components/
      Sidebar/
        Sidebar.tsx
        ProjectNode.tsx
        WorktreeRow.tsx
        StatusDot.tsx
      shortcuts/
        useProjects.ts         # hook que envuelve window.jide.projects.*
        useWorktrees.ts
    App.tsx                    # reemplaza wordmark central por Sidebar real
tests/
  unit/main/git/               # tests con repos tmp creados al vuelo
  e2e/projects.spec.ts
```

### Tasks (alto nivel)

- [ ] **2.1** Decidir wrapper git: `simple-git` vs `execa('git', …)`. Spike de 1h.
- [ ] **2.2** `Project` y `Worktree` types compartidos + extender `SettingsSchema` con `projects: Project[]`.
- [ ] **2.3** `GitClient` con `worktree list --porcelain` parser. Test: repo tmp con 2 worktrees → devuelve ambos.
- [ ] **2.4** `GitClient.status()` — ahead/behind/changes count. Test: repo tmp con commits sin push + ficheros modificados.
- [ ] **2.5** `GitClient.worktreeAdd(branch, path)` y `worktreeRemove(path)`. Test: roundtrip.
- [ ] **2.6** `ProjectRegistry` sobre store: add/list/remove con validación de path existente.
- [ ] **2.7** Canales IPC `projects:add/list/remove`. E2E: añadir, listar, eliminar.
- [ ] **2.8** Canales IPC `worktrees:list/add/remove`. E2E: crear worktree desde dialog.
- [ ] **2.9** `Sidebar` componente con árbol expandible (proyectos → worktrees). Snapshot test.
- [ ] **2.10** `WorktreeRow` con `StatusDot` (idle/running/awaiting/error). Datos reales de git status.
- [ ] **2.11** Watcher chokidar por proyecto que dispara re-fetch de status en cambios filesystem.
- [ ] **2.12** Sustituir el wordmark central de Fase 1 por la Sidebar conectada.
- [ ] **2.13** Diálogo nativo de Electron `dialog.showOpenDialog` para elegir carpeta al añadir proyecto.

### Decisiones abiertas

1. **simple-git vs execa('git', …):** simple-git es más cómodo pero añade dependencia. execa es más controlable y el parser custom nos da tipos exactos. Recomendación: execa + parser propio (más trabajo pero más control de errores y output estructurado).
2. **¿Qué pasa si el usuario añade un path que no es git?** Mostrar error en UI. Validar en `ProjectRegistry.add` antes de persistir.
3. **¿Refresh de status: polling o solo en eventos?** chokidar + debounce 500ms. Sin polling.

### Definition of Done

- [ ] Añadir un proyecto local con dialog nativo persiste y aparece en la Sidebar tras reload.
- [ ] Sidebar muestra worktrees reales con `branch`, `changes`, `ahead`, `behind` correctos.
- [ ] Crear un worktree desde el dialog (rama existente o nueva) ejecuta `git worktree add` y aparece sin reload.
- [ ] Modificar un fichero en un worktree actualiza el contador `changes` en <1s.
- [ ] Eliminar un proyecto/worktree limpia el store y el filesystem (con confirmación).

### Hand-off a Fase 3

- `Project` / `Worktree` types ya existen — Fase 3 los referenciará.
- `GitClient` está disponible por proyecto — Fase 3 lo usa para `cwd` correcto al spawnear `claude`.
- La Sidebar muestra status dot pero todos los worktrees están en `idle` — Fase 3 hace que cambien a `running/awaiting`.

---

## Fase 3 — Sesión Claude end-to-end (vertical slice)

**Goal:** Un worktree puede tener una sesión Claude funcionando real: spawn del CLI, stream de eventos parseado, render de mensajes (user/claude/tool/diff), composer que envía prompts, kill con confirmación. **Una sola sesión por worktree** — multi-sesión llega en Fase 4.

**Riesgo principal:** esta es la fase que valida si el proyecto entero tiene sentido. Si el CLI de Claude Code no expone un protocolo apto para wrap, hay que pivotar. Por eso esta fase va antes que cualquier polish.

**Stack añadido:** child_process / execa con stream parsing, posiblemente `JSONStream` o un parser custom de NDJSON.

### Pre-requisito de spike

Antes de escribir el plan ejecutable de esta fase, hacer **spike documental de 2h**: leer la documentación del CLI `claude` (flags `--stream-json`, `--print`, `--input-format`, hooks, event schema). Sin entender el protocolo concreto el plan no se puede escribir bien. Resultado del spike: `.planning/research/claude-cli-protocol.md`.

### Nuevos archivos / cambios

```
src/
  main/
    claude/
      session.ts               # ClaudeSession: spawn + stream + lifecycle
      protocol.ts              # parser del stream-json del CLI
      manager.ts               # SessionManager: un session por worktree (fase 3) / N (fase 4)
    ipc/
      sessions.ts              # sessions:start/send/kill + eventos sessions:event
  shared/
    session.ts                 # Session, Message types
    ipc.ts                     # +canales sessions:*
  renderer/src/
    components/
      Chat/
        ChatPanel.tsx
        Message.tsx            # router por tipo
        UserMessage.tsx
        ClaudeMessage.tsx
        ToolMessage.tsx        # collapsible
        DiffMessage.tsx        # +/- coloring
        SystemMessage.tsx
        StreamingIndicator.tsx
        ApprovalBar.tsx        # awaiting → approve/reject
        Composer.tsx
      shortcuts/
        useSession.ts          # hook para sesión activa del worktree
tests/
  fixtures/
    fake-claude.mjs            # CLI fake que emite stream JSON conocido
  unit/main/claude/
  e2e/session.spec.ts
```

### Tasks (alto nivel)

- [ ] **3.1** Spike del protocolo CLI de Claude (resultado: doc en `.planning/research/`).
- [ ] **3.2** `Message` type discriminado (`user | claude | tool | diff | system`) en shared.
- [ ] **3.3** `protocol.ts`: parser de NDJSON → `Message[]`. Test con fixtures de eventos reales.
- [ ] **3.4** `fake-claude.mjs` CLI de tests que emite secuencias deterministas — clave para tests reproducibles sin red.
- [ ] **3.5** `ClaudeSession` clase con `spawn`, `send(prompt)`, `kill()`, EventEmitter. Test con fake-claude.
- [ ] **3.6** `SessionManager.startForWorktree(wtId)` — Fase 3 garantiza 1 sesión por worktree.
- [ ] **3.7** Canales IPC `sessions:start/send/kill` (request/response) + `sessions:event` (stream main→renderer vía `webContents.send`).
- [ ] **3.8** Componentes Message por tipo, con estilos del mock como referencia visual.
- [ ] **3.9** `Composer` con textarea autoresize y Enter / Shift+Enter.
- [ ] **3.10** `StreamingIndicator` mientras claude está en `running`.
- [ ] **3.11** `ApprovalBar` cuando claude está `awaiting` — botones Approve/Reject que mandan respuesta de vuelta.
- [ ] **3.12** Conectar `ChatPanel` al worktree activo de la Sidebar.
- [ ] **3.13** E2E con fake-claude que verifica el flujo completo end-to-end.

### Decisiones abiertas

1. **¿Cómo expone Claude Code el stream?** Determinado por el spike. Probablemente `--output-format stream-json` sobre stdout.
2. **¿Cómo se envía un prompt a una sesión viva?** stdin? socket? archivo temp? Determinado por el spike.
3. **¿Approve/Reject de tool calls cómo se transmite al CLI?** Determinado por el spike. Si el CLI no lo soporta, hay que negociar el feature con Anthropic o pivotar a wrap del SDK directamente.
4. **¿Las tool calls se renderizan colapsadas por defecto?** Sí — solo bash y edit_file con cambios grandes. Auto-expandir si tienen <5 líneas.

### Riesgo: pivot del CLI al SDK

Si el CLI de Claude Code no expone control suficiente, el plan se vuelve: usar `@anthropic-ai/claude-agent-sdk` directamente desde Node main process. Implica que jide es el host del agente, no un orquestador del CLI. Eso es más trabajo pero da control total. **El spike (3.1) decide.**

### Definition of Done

- [ ] Selecciono un worktree → puedo escribir un prompt en el composer → veo la respuesta de Claude streaming en pantalla.
- [ ] Tool calls aparecen como tarjetas con cmd/file/status/output.
- [ ] Si Claude pide aprobar un cambio, aparece la ApprovalBar con Approve/Reject funcional.
- [ ] El status dot del worktree en Sidebar refleja `running/awaiting/idle` en tiempo real.
- [ ] Kill session mata el proceso y limpia el estado.
- [ ] Cerrar la app mientras hay sesiones activas las mata limpiamente (no zombies).

### Hand-off a Fase 4

- `SessionManager` está diseñado para 1 sesión por worktree, pero su interfaz interna debe ser `Map<wtId, Session[]>` desde el día uno — Fase 4 sólo levanta el límite.
- Los componentes Chat ya saben recibir una `Session` por prop — Fase 4 añade el `SessionStrip` arriba.

---

## Fase 4 — Multi-sesión por worktree

**Goal:** Un worktree puede tener N sesiones Claude paralelas, cada una con su proceso y conversación. La UI muestra el `SessionStrip` de chips para cambiar entre ellas, crear nuevas y cerrar las inactivas.

**Riesgo principal:** concurrencia de procesos. N×M procesos `claude` corriendo a la vez (N worktrees × M sesiones) puede agotar memoria o tokens. Necesitamos límites razonables.

### Nuevos archivos / cambios

```
src/
  main/claude/
    manager.ts                 # levanta restricción de 1-por-worktree
    limits.ts                  # MAX_SESSIONS_PER_WORKTREE, MAX_TOTAL_SESSIONS
  shared/session.ts            # +SessionMeta: tokens, ctxPct, costUsd, model
  renderer/src/components/Chat/
    SessionStrip.tsx           # chips de sesiones del worktree activo
    SessionChip.tsx
    SessionMeta.tsx            # bandita superior: modelo, tokens, ctx%, $
    EmptySessions.tsx          # estado vacío con CTA "Nueva sesión"
tests/
  unit/main/claude/manager.test.ts  # ampliado: N sesiones concurrentes
  e2e/multi-session.spec.ts
```

### Tasks (alto nivel)

- [ ] **4.1** `SessionManager` levanta el límite 1-por-worktree; `MAX_SESSIONS_PER_WORKTREE = 8` (configurable).
- [ ] **4.2** Roll-up de estado por worktree: `running > awaiting > error > idle` (ya está en mock `data.jsx:156` — portar).
- [ ] **4.3** `SessionStrip` con chips horizontales, scroll si hay muchas. Click selecciona, hover muestra X.
- [ ] **4.4** Botón `+` al final del strip → nueva sesión.
- [ ] **4.5** `SessionMeta` con modelo, tokens, ctxPct, costUsd (vienen del stream JSON).
- [ ] **4.6** `EmptySessions` cuando el worktree no tiene sesiones — CTA grande.
- [ ] **4.7** Hotkey ⌘T para "nueva sesión en worktree activo" (wired aquí, palette completa en Fase 8).
- [ ] **4.8** Persistencia de `activeSessionByWt` en store: al volver a un worktree, abre la última sesión enfocada.

### Decisiones abiertas

1. **¿Límite por worktree?** 8 por defecto, configurable en Ajustes. Aviso visual al llegar a 6.
2. **¿Qué pasa con las sesiones al cerrar la app?** Opción A: mata todas (simple). Opción B: persiste historial y permite resume al reabrir (depende del CLI). Para Fase 4 → opción A. Resume queda para futuro.
3. **¿Sesiones se enumeran o se les pone título?** El CLI puede inferir título de los primeros prompts. Si no, "Sesión 1/2/3". El usuario puede renombrar (futuro).

### Definition of Done

- [ ] Click en `+` del SessionStrip crea una sesión nueva sin afectar las otras.
- [ ] Tengo 3 sesiones corriendo en paralelo en un worktree — todas streamean independientemente.
- [ ] El status dot del worktree refleja el roll-up de las 3 sesiones.
- [ ] Cerrar la sesión activa selecciona la siguiente automáticamente.
- [ ] Reabrir la app vuelve al worktree y sesión donde lo dejé.

### Hand-off a Fase 5

- El renderer ya tiene casi todos los componentes Chat — Fase 5 solo añade el shell que los rodea (TabBar, Sidebar refinada, StatusBar).

---

## Fase 5 — Tabs + UI shell completa

**Goal:** La app se ve y se siente como el mock. Tab bar con worktrees abiertos (persistente), Sidebar pulida con secciones (Proyectos, Atajos), StatusBar inferior con la banda accent, Tweaks runtime (theme light/dark, density, accent, sidebar side).

**Riesgo principal:** ninguno técnico. El reto es disciplina visual — no salirse de los tokens definidos.

### Nuevos archivos / cambios

```
src/
  shared/theme.ts              # tokens: light/dark, density (comfy/cozy/compact), accent
  renderer/src/
    theme/
      ThemeProvider.tsx
      tokens.ts                # portado del mock theme.jsx
      useTheme.ts
    components/
      TabBar/
        TabBar.tsx
        Tab.tsx
      Sidebar/                 # refinar lo de Fase 2
        SidebarSection.tsx
        SidebarRow.tsx
        Kbd.tsx
      StatusBar/
        StatusBar.tsx
        StatusItem.tsx
      Chrome/
        TopChromeStrip.tsx     # traffic lights + project breadcrumb
        MacFrame.tsx           # ya existe via window.ts; portar visual del mock
      Tweaks/
        TweaksPanel.tsx        # popover de settings runtime
tests/
  unit/renderer/theme.test.ts
  e2e/shell.spec.ts
```

### Tasks (alto nivel)

- [ ] **5.1** Portar tokens del mock (`design/project/jide/theme.jsx`) a `shared/theme.ts`. Light + dark.
- [ ] **5.2** `ThemeProvider` con context React; `useTheme()` hook.
- [ ] **5.3** Persistir `theme`, `density`, `accent`, `sidebarSide` en store (ya hay infra de Fase 1).
- [ ] **5.4** `TabBar` de worktrees abiertos (tabs ≠ archivos — tabs = worktrees). Persistencia.
- [ ] **5.5** Cerrar tab, abrir nueva tab al seleccionar worktree no presente.
- [ ] **5.6** `StatusBar` inferior con branch/ahead/behind/changes/claude/cli/toggles.
- [ ] **5.7** `TopChromeStrip` con traffic lights nativos + breadcrumb proyecto/branch + botón ⌘K (todavía mock).
- [ ] **5.8** `TweaksPanel` (popover desde botón en sidebar) para cambiar theme/density/accent/side en vivo.
- [ ] **5.9** Animaciones del mock: pulse para status dots running, blink para cursor.
- [ ] **5.10** Snapshot tests visuales con Playwright para light y dark.

### Definition of Done

- [ ] Comparación lado a lado con el mock: indistinguible a 1× zoom (modulo contenido dinámico).
- [ ] Cambiar theme entre light/dark/auto no requiere reload.
- [ ] Cambiar accent a otro color (de la paleta del mock) actualiza la banda inferior y los acentos de sidebar.
- [ ] Cerrar y reabrir la app preserva: theme, density, accent, sidebar side, tabs abiertos.

### Hand-off a Fase 6

- El layout ya soporta split (split-v / split-h / off) a nivel de marcado — Fase 6 lo rellena con el terminal real.

---

## Fase 6 — Terminal split

**Goal:** Cada worktree tiene un terminal interactivo (zsh por defecto) en su cwd. Toggle con ⌘\ alterna off → bottom split → side split. Salida real del proceso, input real del usuario.

**Riesgo principal:** `node-pty` requiere recompilación nativa por versión de Electron. Si el setup de electron-rebuild no es robusto, el dev experience se rompe en cada bump.

**Stack añadido:** `node-pty`, `xterm.js`, `@xterm/addon-fit`, `@xterm/addon-web-links`, `electron-rebuild` (o `@electron/rebuild`).

### Nuevos archivos / cambios

```
src/
  main/
    pty/
      manager.ts               # PtyManager: spawn/write/resize/kill por worktree
      shell-detect.ts          # detecta zsh/bash según OS y user shell
    ipc/
      terminal.ts              # canales terminal:* + eventos terminal:data
  renderer/src/components/Terminal/
    TerminalPanel.tsx          # contiene xterm.js
    TerminalHeader.tsx         # zsh · path + toggles
    useXterm.ts                # hook que monta xterm + suscribe a eventos main
electron-builder.yml           # primer uso real para configurar rebuild de node-pty
package.json                   # +scripts: postinstall electron-rebuild
tests/
  unit/main/pty/
  e2e/terminal.spec.ts
```

### Tasks (alto nivel)

- [ ] **6.1** Setup electron-rebuild + script `postinstall`. Verificar que `pnpm install` deja node-pty compilado para Electron 35.
- [ ] **6.2** `PtyManager.create(wtId, cwd)` → spawnea shell con env limpio + cwd correcto.
- [ ] **6.3** Stream stdout del PTY como eventos `terminal:data` (chunked).
- [ ] **6.4** Canal `terminal:write` para input del usuario.
- [ ] **6.5** Canal `terminal:resize` cuando el panel cambia tamaño.
- [ ] **6.6** `useXterm` monta xterm.js con tema sincronizado a `useTheme()`.
- [ ] **6.7** Toggle ⌘\ off/bottom-split/side-split (ya hay state en Fase 5).
- [ ] **6.8** Persistir orientación del split por worktree.
- [ ] **6.9** Cerrar la sesión PTY al cerrar el tab del worktree.
- [ ] **6.10** Cleanup al cerrar la app: matar todos los PTYs.

### Decisiones abiertas

1. **¿Un PTY por worktree o un PTY por tab?** Un PTY por worktree (persiste entre tabs cerrados/abiertos del mismo worktree). Si el usuario lo cierra explícitamente sí muere.
2. **¿Shell por defecto?** El del usuario (`$SHELL`). Configurable en Ajustes (futuro).
3. **¿Cómo se sincroniza el cwd cuando claude cambia de carpeta?** El PTY tiene su propio cwd; no nos sincronizamos con claude. Si el usuario teclea `cd`, sí.

### Definition of Done

- [ ] ⌘\ abre un terminal funcional en el worktree activo con cwd correcto.
- [ ] Puedo correr `git status`, `pnpm test`, `vim README.md` (incluyendo apps interactivas con curses).
- [ ] El terminal sobrevive a cambiar de tab y volver.
- [ ] Theme dark/light se aplica al terminal.

### Hand-off a Fase 7

- Existe ya infraestructura de eventos main→renderer streaming (terminal:data) — Fase 7 reutiliza el patrón para `files:watch`.

---

## Fase 7 — File viewer read-only + watcher

**Goal:** Panel lateral con el árbol del worktree y un visor read-only de archivos con syntax highlight. El árbol se actualiza en vivo cuando cambian archivos (cambios externos o de Claude). Toggle con ⌘O.

**Riesgo principal:** rendimiento del watcher en repos grandes (monorepos). Necesita ignore de `node_modules`, `.git`, `dist`, etc.

**Stack añadido:** `chokidar` (ya hay infra de Fase 2 pero ampliada), `shiki` (para syntax highlight con tokens VS Code) o `highlight.js`.

### Nuevos archivos / cambios

```
src/
  main/
    files/
      tree.ts                  # construye árbol jerárquico desde fs
      watcher.ts               # chokidar por worktree con ignore patterns
      reader.ts                # lectura segura (límite de tamaño, detección binaria)
    ipc/files.ts               # canales files:tree / files:read + eventos files:change
  renderer/src/components/FileViewer/
    FileViewerPanel.tsx
    FileTree.tsx
    FileTreeNode.tsx           # recursivo, expand/collapse
    FileContent.tsx            # render con shiki/highlight
    BinaryFilePlaceholder.tsx
tests/
  unit/main/files/
  e2e/file-viewer.spec.ts
```

### Tasks (alto nivel)

- [ ] **7.1** `tree.ts` con ignore patterns (`.gitignore` + lista fija: `.git`, `node_modules`, `dist`, `out`, `.vite`).
- [ ] **7.2** `watcher.ts` con debounce 200ms; emite eventos `add/change/unlink/addDir/unlinkDir`.
- [ ] **7.3** Anotar cada nodo con git status (`M/A/D/??` via `git status --porcelain`).
- [ ] **7.4** Canal `files:tree` (request/response) + `files:change` (stream).
- [ ] **7.5** `reader.ts` con límite de tamaño (1MB por defecto), detección binaria (magic numbers).
- [ ] **7.6** `FileTree` con virtualización si >500 nodos (`react-window`).
- [ ] **7.7** `FileContent` con shiki (theme sincronizado).
- [ ] **7.8** `BinaryFilePlaceholder` para binarios — "este archivo es binario, no se puede previsualizar".
- [ ] **7.9** Toggle ⌘O para abrir/cerrar el panel.
- [ ] **7.10** Click en un archivo desde un tool message del chat ("edit_file: foo.ts") abre ese archivo en el viewer.

### Decisiones abiertas

1. **¿shiki o highlight.js?** shiki es más bonito pero más pesado (WASM). highlight.js es más ligero pero menos preciso. Recomendación: shiki — el viewer es una superficie clave del producto.
2. **¿Mostramos diffs en el viewer cuando un archivo está modificado?** v1 no, solo contenido current. v2: toggle "show diff vs HEAD".

### Definition of Done

- [ ] ⌘O abre el visor mostrando árbol + último archivo abierto.
- [ ] Cambiar un archivo externamente (vim, otro editor) actualiza el árbol y el contenido si está abierto.
- [ ] Archivos modificados (`M`) y nuevos (`A`) llevan badge de color.
- [ ] No se puede editar — los inputs están deshabilitados o el render es `<pre>`.
- [ ] Click en `file` de una tarjeta tool del chat abre ese archivo.

### Hand-off a Fase 8

- Todos los componentes principales ya existen — Fase 8 solo añade el orquestador (palette) y los atajos globales.

---

## Fase 8 — Command palette + atajos globales

**Goal:** ⌘K abre la palette con búsqueda fuzzy (Worktrees / Acciones / Archivos). Todos los atajos del mock funcionan: ⌘N nuevo worktree, ⌘T nueva sesión, ⌘⇧K kill, ⌘\ terminal, ⌘O viewer, Esc cerrar. Diálogos new-worktree y kill-confirm.

**Riesgo principal:** ninguno relevante.

**Stack añadido:** `cmdk` (palette UI lib de Vercel) o `fuse.js` (fuzzy search) — decisión abierta.

### Nuevos archivos / cambios

```
src/renderer/src/
  components/
    CommandPalette/
      CommandPalette.tsx
      PaletteInput.tsx
      PaletteGroup.tsx
      PaletteItem.tsx
    dialogs/
      NewWorktreeDialog.tsx
      KillConfirmDialog.tsx
      Overlay.tsx              # backdrop + ESC + click-outside
  shortcuts/
    useGlobalShortcuts.ts      # hook único con todos los atajos
    keymap.ts                  # tabla declarativa
tests/
  e2e/shortcuts.spec.ts
  e2e/palette.spec.ts
```

### Tasks (alto nivel)

- [ ] **8.1** Decidir: cmdk vs fuse.js. cmdk da UI + fuzzy en uno, opinionated. Recomendación: cmdk.
- [ ] **8.2** `keymap.ts` declarativo: `[{ keys: 'meta+k', action: 'palette.open', when: 'always' }, ...]`.
- [ ] **8.3** `useGlobalShortcuts` con `when` conditions (when a modal is open, casi todos los atajos se inhiben excepto Esc).
- [ ] **8.4** `CommandPalette` con grupos (Worktrees / Acciones / Archivos) cargados dinámicamente.
- [ ] **8.5** Fuzzy search en título + hint.
- [ ] **8.6** `NewWorktreeDialog` con form: branch existente (combobox) o nueva (input).
- [ ] **8.7** `KillConfirmDialog` con detalle de la sesión y warning.
- [ ] **8.8** `Overlay` reutilizable con backdrop blur y trap focus.
- [ ] **8.9** Snapshot test E2E del flujo: ⌘K → buscar "billing" → seleccionar worktree → cambia tab.
- [ ] **8.10** Help dialog (¿) con lista de todos los atajos (generado de `keymap.ts`).

### Definition of Done

- [ ] Todos los atajos del mock funcionan tal cual están documentados.
- [ ] La palette es ágil (<50ms para abrir).
- [ ] Esc siempre cierra el overlay top-most.
- [ ] El diálogo de nuevo worktree crea ramas con `git worktree add -b`.
- [ ] La búsqueda en palette es insensible a acentos y mayúsculas.

### Hand-off a Fase 9

- La app está feature-complete. Lo que queda es empaquetado, code signing, auto-update.

---

## Fase 9 — Polish & packaging

**Goal:** Distribuir la app firmada y notarizada para macOS, Windows (firmado) y Linux (AppImage + .deb). Auto-update funciona. Onboarding mínimo al primer arranque.

**Riesgo principal:** code signing macOS requiere cuenta de Apple Developer ($99/año), certificado, y notarización. Si no se hace bien, el binario está roto en máquinas que no son la del dev.

**Stack añadido:** `electron-builder`, `electron-updater`, `@electron/notarize` (transitive).

### Nuevos archivos / cambios

```
electron-builder.yml           # config completa
build/
  entitlements.mac.plist
  icon.icns
  icon.ico
  icon.png
  background.png               # DMG background
src/main/
  updater.ts                   # electron-updater wiring
  onboarding.ts                # first-run dialog
.github/workflows/
  release.yml                  # build + sign + notarize + publish on tag
docs/
  RELEASING.md
```

### Tasks (alto nivel)

- [ ] **9.1** `electron-builder.yml` con targets: macOS dmg+zip, Windows nsis, Linux AppImage+deb.
- [ ] **9.2** Assets: icon en tres formatos (icns, ico, png 1024×).
- [ ] **9.3** macOS code signing: cargar cert en keychain CI, env vars `CSC_LINK` + `CSC_KEY_PASSWORD`, entitlements (hardened runtime, allow JIT).
- [ ] **9.4** macOS notarization vía `@electron/notarize` con app-specific password.
- [ ] **9.5** Windows code signing (cert EV o standard) — opcional para v1, pero recomendado.
- [ ] **9.6** `updater.ts` con check al arrancar + check periódico (cada 4h). Source: GitHub Releases.
- [ ] **9.7** `release.yml` en GH Actions: build matrix (ubuntu, macos-latest, windows-latest), sube artefactos a Release.
- [ ] **9.8** `onboarding.ts` first-run: pregunta si añadir el primer proyecto.
- [ ] **9.9** About dialog nativo con versión, build sha, link a issues.
- [ ] **9.10** Preferences nativo (CMD+,) con tabs: Theme / Density / Atajos / Acerca de.
- [ ] **9.11** `RELEASING.md` documentando el flujo de versionado y release.

### Decisiones abiertas

1. **¿Auto-update silencioso o con prompt?** Prompt — "hay una actualización, instalar al cerrar". Sin sorpresas.
2. **¿Telemetría?** No por defecto. Si se añade en futuro: opt-in explícito, anonimizado, posthog o similar.
3. **¿Channel beta/stable?** v1: solo stable. Beta llega cuando haya usuarios.

### Definition of Done

- [ ] `pnpm release` en local genera DMG + ZIP firmados y notarizados que abren limpios en macOS Sequoia sin Gatekeeper warnings.
- [ ] El binario corre en una máquina virgen sin Node, pnpm, ni nada.
- [ ] Una nueva release en GitHub dispara CI que genera y publica artefactos para los tres OS.
- [ ] La app instalada detecta una nueva versión, pregunta, y actualiza al reiniciar.

### Hand-off

Final del roadmap. Próxima fase: post-1.0 (feedback de usuarios → backlog).

---

## Apéndice: orden de migración de features del mock

Para evitar que se pierda nada del mock original (`design/project/jide/`), aquí está el mapping a fases:

| Feature del mock (archivo) | Fase |
|---|---|
| MacFrame + traffic lights (`macframe.jsx`) | 1, refinado en 5 |
| Wordmark jide (`sidebar.jsx`) | 1, refinado en 5 |
| Project tree (`sidebar.jsx` — ProjectNode, WorktreeRow) | 2 |
| StatusDot por worktree | 2, animaciones en 5 |
| Tab bar (`tabs.jsx`) | 5 |
| Chat panel (`chat.jsx` — Msg, Composer) | 3 |
| Tool/Diff messages | 3 |
| ApprovalBar | 3 |
| StreamingIndicator | 3 |
| SessionStrip + chips (`chat.jsx`) | 4 |
| SessionMeta (modelo, tokens, ctx%, $) | 4 |
| Terminal panel (`terminal.jsx`) | 6 |
| FileViewer (`terminal.jsx` — FileViewerPanel) | 7 |
| StatusBar inferior (`overlays.jsx`) | 5 |
| Command palette (`overlays.jsx`) | 8 |
| NewWorktreeDialog (`overlays.jsx`) | 2 (mínimo) + 8 (refinado) |
| KillConfirmDialog (`overlays.jsx`) | 8 |
| Tweaks runtime panel (`tweaks.jsx`) | 5 |
| Theme tokens (`theme.jsx`) | 5 |
| Icons (`icons.jsx`) | 1 (set base) + por fase (icons puntuales) |
