import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execaSync } from 'execa';
import { launchJide } from './helpers/launch';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT_A = resolve(here, '../fixtures/claude-events/multi-session-a.script.json');

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'jide-e2e-kill-'));
  execaSync('git', ['init', '--initial-branch=main', dir]);
  execaSync('git', ['-C', dir, 'config', 'user.email', 'e2e@jide.local']);
  execaSync('git', ['-C', dir, 'config', 'user.name', 'e2e']);
  execaSync('git', ['-C', dir, 'config', 'commit.gpgsign', 'false']);
  execaSync('git', ['-C', dir, 'commit', '--allow-empty', '-m', 'init']);
  return dir;
}

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

test.describe('kill-session shortcut', () => {
  test('Mod+Shift+K opens KillConfirmDialog; cancel keeps the session; confirm removes it', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-kill-store-'));
    const app = await launchJide({
      dialogReturnPath: repoDir,
      storeCwd,
      fakeClaudeScript: SCRIPT_A,
    });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();
    await expect(page.getByTestId('empty-sessions')).toBeVisible();
    await page.getByTestId('empty-sessions-cta').click();

    // Wait for the session chip and prove a session is active in the strip.
    const chip = page.locator('[role="tab"][data-testid^="session-chip-"]');
    await expect(chip).toHaveCount(1);
    await expect(page.getByTestId('composer-input')).toBeVisible();

    // Send a message so the session.kill predicate's `sessionActive` is true
    // (covers the strict path where activeSession must be resolved).
    await page.getByTestId('composer-input').fill('Hello A');
    await page.getByTestId('composer-input').press('Enter');
    await expect(
      page.locator('[data-testid^="message-claude-"]', { hasText: 'Reply from session A.' }),
    ).toBeVisible({ timeout: 10000 });

    // Cancel path: Mod+Shift+K → dialog → Cancelar → session still alive.
    await page.keyboard.press(`${MOD}+Shift+K`);
    await expect(page.getByTestId('kill-confirm-dialog')).toBeVisible();
    await expect(page.getByTestId('kill-confirm-submit')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('kill-confirm-dialog')).toHaveCount(0);
    await expect(chip).toHaveCount(1);

    // Confirm path: Mod+Shift+K → dialog → Matar → session disappears.
    await page.keyboard.press(`${MOD}+Shift+K`);
    await expect(page.getByTestId('kill-confirm-dialog')).toBeVisible();
    await page.getByTestId('kill-confirm-submit').click();
    await expect(page.getByTestId('kill-confirm-dialog')).toHaveCount(0);
    await expect(chip).toHaveCount(0);

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });
});
