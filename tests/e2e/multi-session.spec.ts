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
  const dir = mkdtempSync(join(tmpdir(), 'jide-e2e-multi-'));
  execaSync('git', ['init', '--initial-branch=main', dir]);
  execaSync('git', ['-C', dir, 'config', 'user.email', 'e2e@jide.local']);
  execaSync('git', ['-C', dir, 'config', 'user.name', 'e2e']);
  execaSync('git', ['-C', dir, 'config', 'commit.gpgsign', 'false']);
  execaSync('git', ['-C', dir, 'commit', '--allow-empty', '-m', 'init']);
  return dir;
}

test.describe('multi-session', () => {
  test('create two sessions, switch between them, transcripts isolated', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-multi-store-'));
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
    // Wait for the first chip to render before the composer becomes reachable.
    await expect(page.locator('[role="tab"][data-testid^="session-chip-"]')).toHaveCount(1);
    await expect(page.getByTestId('composer-input')).toBeVisible();

    await page.getByTestId('composer-input').fill('Hello A');
    await page.getByTestId('composer-input').press('Enter');
    await expect(
      page.locator('[data-testid^="message-claude-"]', { hasText: 'Reply from session A.' }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('[data-testid^="message-user-"]', { hasText: 'Hello A' }),
    ).toBeVisible();

    await page.getByTestId('session-strip-new').click();
    await expect(page.locator('[role="tab"][data-testid^="session-chip-"]')).toHaveCount(2);

    // After switching to the new (empty) session the previous user prompt
    // must not be visible — transcript isolation.
    await expect(
      page.locator('[data-testid^="message-user-"]', { hasText: 'Hello A' }),
    ).toHaveCount(0);

    // Switch back to the first chip and the prior transcript reappears.
    const firstChip = page.locator('[role="tab"][data-testid^="session-chip-"]').first();
    await firstChip.click();
    await expect(
      page.locator('[data-testid^="message-user-"]', { hasText: 'Hello A' }),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid^="message-claude-"]', { hasText: 'Reply from session A.' }),
    ).toBeVisible();

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('hotkey (Mod+t) creates a new session', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-multi-store-'));
    const app = await launchJide({
      dialogReturnPath: repoDir,
      storeCwd,
      fakeClaudeScript: SCRIPT_A,
    });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();
    await page.getByTestId('empty-sessions-cta').click();
    await expect(page.locator('[role="tab"][data-testid^="session-chip-"]')).toHaveCount(1);

    await page.getByTestId('composer-input').fill('A');
    await page.getByTestId('composer-input').press('Enter');
    await expect(page.locator('[data-testid^="message-claude-"]').first()).toBeVisible({
      timeout: 5000,
    });

    // The composer is INPUT-focused after pressing Enter; useSessionHotkey
    // ignores keydown when the target is INPUT, so click outside first.
    await page.getByTestId('session-strip').click();

    const hotkey = process.platform === 'darwin' ? 'Meta+t' : 'Control+t';
    await page.keyboard.press(hotkey);
    await expect(page.locator('[role="tab"][data-testid^="session-chip-"]')).toHaveCount(2);

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('cap of 4 disables the + button', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-multi-store-'));
    const app = await launchJide({
      dialogReturnPath: repoDir,
      storeCwd,
      fakeClaudeScript: SCRIPT_A,
    });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();
    await page.getByTestId('empty-sessions-cta').click();
    await expect(page.locator('[role="tab"][data-testid^="session-chip-"]')).toHaveCount(1);

    for (let i = 0; i < 3; i++) {
      await page.getByTestId('session-strip-new').click();
    }

    await expect(page.locator('[role="tab"][data-testid^="session-chip-"]')).toHaveCount(4);
    await expect(page.getByTestId('session-strip-new')).toBeDisabled();

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('persistence: a session survives a close+relaunch', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-multi-store-'));

    // Run 1 — create one session, send a prompt, wait for the response, then
    // close. before-quit persists the session because it has messages.
    {
      const app = await launchJide({
        dialogReturnPath: repoDir,
        storeCwd,
        fakeClaudeScript: SCRIPT_A,
      });
      const page = await app.firstWindow();

      await page.evaluate(() => window.jide.projects.add());
      await page.getByTestId('worktree-main').click();
      await page.getByTestId('empty-sessions-cta').click();
      await expect(page.getByTestId('session-strip')).toBeVisible();
      await page.getByTestId('composer-input').fill('Persist me');
      await page.getByTestId('composer-input').press('Enter');
      await expect(
        page.locator('[data-testid^="message-claude-"]', { hasText: 'Reply from session A.' }),
      ).toBeVisible({ timeout: 5000 });

      await app.close();
    }

    // Run 2 — same storeCwd, so the project + session are rehydrated. We
    // still pass dialogReturnPath defensively; no second add() call is made.
    {
      const app = await launchJide({
        dialogReturnPath: repoDir,
        storeCwd,
        fakeClaudeScript: SCRIPT_A,
      });
      const page = await app.firstWindow();

      await page.getByTestId('worktree-main').click();
      await expect(page.locator('[role="tab"][data-testid^="session-chip-"]')).toHaveCount(1);
      await expect(
        page.locator('[data-testid^="message-claude-"]', { hasText: 'Reply from session A.' }),
      ).toBeVisible({ timeout: 5000 });

      await app.close();
    }

    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });
});
