import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execaSync } from 'execa';
import { launchJide } from './helpers/launch';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT_A = resolve(here, '../fixtures/claude-events/multi-session-a.script.json');

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'jide-e2e-shortcuts-'));
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

test.describe('global shortcuts (keymap.ts)', () => {
  test('palette.open (Mod+K) fires from any state and is no-op when palette is already open', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-shortcuts-store-'));
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    const basename = repoDir.split('/').pop()!;
    await expect(page.getByTestId(`project-${basename}`)).toBeVisible();

    await page.keyboard.press(`${MOD}+k`);
    await expect(page.getByTestId('command-palette')).toBeVisible();
    // Pressing it again with palette already open is a no-op (still just one palette).
    await page.keyboard.press(`${MOD}+k`);
    await expect(page.getByTestId('command-palette')).toHaveCount(1);

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('worktree.new (Mod+N) fires when no modal is open, does NOT fire while palette is open', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-shortcuts-store-'));
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    const basename = repoDir.split('/').pop()!;
    await expect(page.getByTestId(`project-${basename}`)).toBeVisible();

    // Fires from base state.
    await page.keyboard.press(`${MOD}+n`);
    await expect(page.getByTestId('new-worktree-dialog')).toBeVisible();

    // Close the dialog.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('new-worktree-dialog')).toHaveCount(0);

    // Open the palette and try Mod+N — must NOT open a NewWorktreeDialog
    // because worktree.new has NOT_MODAL.
    await page.keyboard.press(`${MOD}+k`);
    await expect(page.getByTestId('command-palette')).toBeVisible();
    await page.keyboard.press(`${MOD}+n`);
    await expect(page.getByTestId('new-worktree-dialog')).toHaveCount(0);

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('tweaks.toggle (Mod+,) opens and pressing again closes (topOverlayId predicate)', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-shortcuts-store-'));
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    const basename = repoDir.split('/').pop()!;
    await expect(page.getByTestId(`project-${basename}`)).toBeVisible();

    await page.keyboard.press(`${MOD}+,`);
    await expect(page.getByTestId('tweaks-panel')).toBeVisible();

    // The shortcut's `when` allows re-fire while tweaks-panel is on top —
    // pressing again must close it.
    await page.keyboard.press(`${MOD}+,`);
    await expect(page.getByTestId('tweaks-panel')).toHaveCount(0);

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('help.open (?) fires when no modal/input focused, does NOT fire while composer is focused', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-shortcuts-store-'));
    const app = await launchJide({
      dialogReturnPath: repoDir,
      storeCwd,
      fakeClaudeScript: SCRIPT_A,
    });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();

    // Body focus path: ? should open help.
    await page.evaluate(() => document.body.focus());
    await page.keyboard.press('?');
    await expect(page.getByTestId('help-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('help-dialog')).toHaveCount(0);

    // Composer-focused path: ? must not open help; the textarea should contain '?'.
    await page.getByTestId('empty-sessions-cta').click();
    await expect(page.getByTestId('composer-input')).toBeVisible();
    await page.getByTestId('composer-input').focus();
    await page.keyboard.press('?');
    await expect(page.getByTestId('help-dialog')).toHaveCount(0);
    await expect(page.getByTestId('composer-input')).toHaveValue('?');

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('overlay.close (Esc) closes top-most overlay; does nothing when no modal is open', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-shortcuts-store-'));
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    const basename = repoDir.split('/').pop()!;
    await expect(page.getByTestId(`project-${basename}`)).toBeVisible();

    // No modal — Esc is a no-op (no errors, no overlays appear).
    await page.evaluate(() => document.body.focus());
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-palette')).toHaveCount(0);
    await expect(page.getByTestId('new-worktree-dialog')).toHaveCount(0);
    await expect(page.getByTestId('help-dialog')).toHaveCount(0);

    // Stack two overlays — Esc must close only the top one (palette).
    await page.keyboard.press(`${MOD}+n`);
    await expect(page.getByTestId('new-worktree-dialog')).toBeVisible();
    await page.keyboard.press(`${MOD}+k`);
    await expect(page.getByTestId('command-palette')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-palette')).toHaveCount(0);
    await expect(page.getByTestId('new-worktree-dialog')).toBeVisible();

    // Second Esc closes the underlying dialog.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('new-worktree-dialog')).toHaveCount(0);

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });
});
