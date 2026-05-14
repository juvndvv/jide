import { test, expect } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchJide } from './helpers/launch';

function makeStore(overrides: Record<string, unknown>): string {
  const storeCwd = mkdtempSync(join(tmpdir(), 'jide-side-'));
  const settings = {
    theme: 'light',
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

test('sidebar moves to the right when sidebarSide is right', async () => {
  const leftStore = makeStore({ sidebarSide: 'left' });
  const appLeft = await launchJide({ storeCwd: leftStore });
  const winLeft = await appLeft.firstWindow();
  await winLeft.getByTestId('sidebar').waitFor({ state: 'visible' });
  const initial = await winLeft.getByTestId('sidebar').boundingBox();
  await appLeft.close();

  const rightStore = makeStore({ sidebarSide: 'right' });
  const appRight = await launchJide({ storeCwd: rightStore });
  const winRight = await appRight.firstWindow();
  await winRight.getByTestId('sidebar').waitFor({ state: 'visible' });
  const flipped = await winRight.getByTestId('sidebar').boundingBox();
  await appRight.close();

  expect(flipped).not.toBeNull();
  expect(initial).not.toBeNull();
  expect(flipped!.x).toBeGreaterThan(initial!.x);
});
