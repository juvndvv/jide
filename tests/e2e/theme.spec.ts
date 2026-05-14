import { test, expect } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchJide } from './helpers/launch';
import { themeProbe, rgbToHex } from './helpers/theme-probe';

function makeStore(overrides: Record<string, unknown>): string {
  const storeCwd = mkdtempSync(join(tmpdir(), 'jide-theme-'));
  const settings = {
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
    ...overrides,
  };
  writeFileSync(join(storeCwd, 'settings.json'), JSON.stringify(settings));
  return storeCwd;
}

async function waitForBg(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof launchJide>>['firstWindow']>>,
  sel: string,
  hex: string,
): Promise<void> {
  await page.waitForFunction(
    ({ s, h }: { s: string; h: string }) => {
      const el = document.querySelector(s);
      if (!el) return false;
      const m = window.getComputedStyle(el).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return false;
      const got =
        '#' +
        [m[1], m[2], m[3]]
          .map((x) => Number(x ?? '0').toString(16).padStart(2, '0').toUpperCase())
          .join('');
      return got === h;
    },
    { s: sel, h: hex },
  );
}

test('light theme paints expected token colors', async () => {
  const storeCwd = makeStore({ theme: 'light', accent: 'coral' });
  const app = await launchJide({ storeCwd });
  const window = await app.firstWindow();
  await waitForBg(window, '[data-testid="sidebar"]', '#F8F6F2');
  const snap = await themeProbe(window);
  expect(rgbToHex(snap.sidebarBg)).toBe('#F8F6F2');
  expect(rgbToHex(snap.tabbarBg)).toBe('#F2EFEA');
  expect(rgbToHex(snap.statusBarBg)).toBe('#F95A5C'); // coral default
  await app.close();
});

test('dark theme swaps surfaces but keeps accent', async () => {
  const storeCwd = makeStore({ theme: 'dark', accent: 'coral' });
  const app = await launchJide({ storeCwd });
  const window = await app.firstWindow();
  await waitForBg(window, '[data-testid="sidebar"]', '#121116');
  const snap = await themeProbe(window);
  expect(rgbToHex(snap.sidebarBg)).toBe('#121116');
  expect(rgbToHex(snap.tabbarBg)).toBe('#0F0E12');
  expect(rgbToHex(snap.statusBarBg)).toBe('#F95A5C');
  await app.close();
});

test('accent swap repaints status bar', async () => {
  const storeCwd = makeStore({ theme: 'light', accent: 'violet' });
  const app = await launchJide({ storeCwd });
  const window = await app.firstWindow();
  await waitForBg(window, '[data-testid="status-bar"]', '#7C67F7');
  const snap = await themeProbe(window);
  expect(rgbToHex(snap.statusBarBg)).toBe('#7C67F7');
  await app.close();
});
