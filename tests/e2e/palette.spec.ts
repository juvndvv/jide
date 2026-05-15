import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execaSync } from 'execa';
import { launchJide } from './helpers/launch';

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'jide-e2e-palette-'));
  execaSync('git', ['init', '--initial-branch=main', dir]);
  execaSync('git', ['-C', dir, 'config', 'user.email', 'e2e@jide.local']);
  execaSync('git', ['-C', dir, 'config', 'user.name', 'e2e']);
  execaSync('git', ['-C', dir, 'config', 'commit.gpgsign', 'false']);
  writeFileSync(join(dir, 'README.md'), '# r\n');
  execaSync('git', ['-C', dir, 'add', '-A']);
  execaSync('git', ['-C', dir, 'commit', '-m', 'init']);
  return dir;
}

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

test.describe('command palette', () => {
  test('Mod+K opens the palette and focuses the input', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-palette-store-'));
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    const basename = repoDir.split('/').pop()!;
    await expect(page.getByTestId(`project-${basename}`)).toBeVisible();

    await page.keyboard.press(`${MOD}+k`);
    await expect(page.getByTestId('command-palette')).toBeVisible();

    const input = page.getByPlaceholder('Buscar acciones, worktrees, archivos…');
    await expect(input).toBeFocused();

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('typing filters the cmdk list to matching items only', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-palette-store-'));
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    const basename = repoDir.split('/').pop()!;
    await expect(page.getByTestId(`project-${basename}`)).toBeVisible();

    await page.keyboard.press(`${MOD}+k`);
    await expect(page.getByTestId('command-palette')).toBeVisible();

    // Before typing: the palette.open action and the worktree row are both
    // visible. (Acciones is reduced to the always-on entries while the palette
    // itself is the top overlay; worktrees are unconditional.)
    const items = page.getByTestId('command-palette').locator('[cmdk-item]');
    await expect(items).toHaveCount(2);

    // Typing "main" narrows down to the worktree row only.
    await page.keyboard.type('main');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText('main');

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('Enter on the focused item dispatches the action and closes the palette', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-palette-store-'));
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    const basename = repoDir.split('/').pop()!;
    await expect(page.getByTestId(`project-${basename}`)).toBeVisible();

    // Confirm no worktree is open yet (no session UI rendered).
    await expect(page.getByTestId('empty-sessions')).toHaveCount(0);

    await page.keyboard.press(`${MOD}+k`);
    await expect(page.getByTestId('command-palette')).toBeVisible();
    await page.keyboard.type('main');

    const item = page
      .getByTestId('command-palette')
      .locator('[cmdk-item]', { hasText: 'main' })
      .first();
    await expect(item).toBeVisible();

    await page.keyboard.press('Enter');

    // After dispatch: palette closes and the worktree opens (empty-sessions
    // CTA appears because no sessions exist yet).
    await expect(page.getByTestId('command-palette')).toHaveCount(0);
    await expect(page.getByTestId('empty-sessions')).toBeVisible();

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  // The accent-insensitive normaliser is covered by the unit tests
  // (`CommandPalette.test.tsx > filters worktrees accent-insensitively`). The
  // default E2E fixture only exposes an ASCII `main` worktree, so the most we
  // can verify here is that the same ASCII query still matches its ASCII
  // target — i.e. the normaliser does not break the happy path.
  // TODO: when a non-ASCII branch fixture is added, replace this with a true
  // accent-stripping case ("são paulo" → query "sao").
  test('search is accent-insensitive (ASCII smoke; non-ASCII covered in unit)', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-palette-store-'));
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    const basename = repoDir.split('/').pop()!;
    await expect(page.getByTestId(`project-${basename}`)).toBeVisible();

    await page.keyboard.press(`${MOD}+k`);
    await expect(page.getByTestId('command-palette')).toBeVisible();
    await page.keyboard.type('main');

    await expect(
      page.getByTestId('command-palette').locator('[cmdk-item]', { hasText: /main/i }).first(),
    ).toBeVisible();

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('Esc closes the palette while leaving an underlying dialog visible (Esc-stack)', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-palette-store-'));
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    const basename = repoDir.split('/').pop()!;
    await expect(page.getByTestId(`project-${basename}`)).toBeVisible();

    // First overlay: NewWorktreeDialog via Mod+N.
    await page.keyboard.press(`${MOD}+n`);
    await expect(page.getByTestId('new-worktree-dialog')).toBeVisible();

    // Second overlay (on top): palette via Mod+K.
    await page.keyboard.press(`${MOD}+k`);
    await expect(page.getByTestId('command-palette')).toBeVisible();

    // Esc must close the top-most overlay (the palette) and leave the dialog.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-palette')).toHaveCount(0);
    await expect(page.getByTestId('new-worktree-dialog')).toBeVisible();

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });
});
