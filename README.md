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

The first run downloads Electron (~120 MB) and Playwright system deps if you trigger E2E tests.

## Scripts

| Command             | What it does                                                           |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm dev`          | Launches Electron with HMR for main + preload + renderer               |
| `pnpm build`        | Production build into `out/`                                           |
| `pnpm preview`      | Runs the production build (no HMR)                                     |
| `pnpm test`         | Vitest unit tests (`tests/unit/**`)                                    |
| `pnpm test:watch`   | Vitest in watch mode                                                   |
| `pnpm test:e2e`     | Playwright E2E in Electron mode (builds first)                         |
| `pnpm typecheck`    | `tsc --noEmit` across the three tsconfig projects                      |
| `pnpm lint`         | ESLint flat config (typed linting in `src/**` and `tests/**`)          |
| `pnpm format`       | Prettier write                                                         |
| `pnpm format:check` | Prettier check (used by CI)                                            |
| `pnpm verify`       | Full local CI chain: typecheck → lint → format:check → test → test:e2e |

> Note: `pnpm ci` is a pnpm built-in (clean-install) and does NOT invoke any script. Use `pnpm verify` for the local CI chain, or `pnpm run verify`.

## Project layout

```
src/
  main/          Electron main process (Node)
    ipc/         Typed IPC channel registry + handlers
    store/       electron-store facade for persisted settings
  preload/       contextBridge — exposes window.jide to the renderer
  renderer/      React 19 SPA
  shared/        Types shared between main, preload, renderer
tests/
  unit/          Vitest (Node environment)
  e2e/           Playwright + Electron
.planning/       Implementation plans by phase (kept out of bundles)
.github/         CI workflows
```

## Architecture in 3 lines

- Renderer talks to main only through `window.jide`, a typed API exposed via `contextBridge`.
- Channels and payload types are defined once in `src/shared/ipc.ts`; main, preload and renderer all consume them. Changing a channel type breaks all three sides at compile time.
- Persisted settings live in `electron-store` (`~/Library/Application Support/jide/settings.json` on macOS), wrapped by `src/main/store/index.ts` with a strict `SettingsSchema`.

## What's implemented (Phase 1)

- Electron 35 boot with hidden-inset title bar, CSP-locked renderer, `window.open` denial.
- Typed IPC bridge with `ping` (demo) and `settings:get` / `settings:set`.
- Persisted theme preference (auto / light / dark) via a temporary toggle button — Phase 5 replaces it with the real Tweaks panel.
- Vitest unit tests for IPC types + store wrapper.
- Playwright E2E for window boot, wordmark render, ping, and settings roundtrip.
- GitHub Actions CI for typecheck / lint / format / unit / E2E.

## What's next

See `.planning/phases/ROADMAP.md`. Phase 2 wires real git worktrees; Phase 3 spawns the first Claude session.

## License

UNLICENSED — internal project, not yet open-sourced.
