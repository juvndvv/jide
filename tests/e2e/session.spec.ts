import { test, expect } from '@playwright/test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execaSync } from 'execa';
import { launchJide } from './helpers/launch';

const here = dirname(fileURLToPath(import.meta.url));
const GREETING_SCRIPT = resolve(here, '../fixtures/claude-events/e2e-greeting.script.json');
const KILL_HANGS_SCRIPT = resolve(here, '../fixtures/claude-events/e2e-kill-hangs.script.json');

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'jide-e2e-session-'));
  execaSync('git', ['init', '--initial-branch=main', dir]);
  execaSync('git', ['-C', dir, 'config', 'user.email', 'e2e@jide.local']);
  execaSync('git', ['-C', dir, 'config', 'user.name', 'e2e']);
  execaSync('git', ['-C', dir, 'config', 'commit.gpgsign', 'false']);
  writeFileSync(join(dir, 'README.md'), '# r\n');
  execaSync('git', ['-C', dir, 'add', '-A']);
  execaSync('git', ['-C', dir, 'commit', '-m', 'init']);
  return dir;
}

test('session: select worktree → send prompt → see claude response from fake-claude', async () => {
  const repoDir = initRepo();
  const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-store-'));
  const app = await launchJide({
    dialogReturnPath: repoDir,
    storeCwd,
    fakeClaudeScript: GREETING_SCRIPT,
  });
  const page = await app.firstWindow();

  await page.evaluate(() => window.jide.projects.add());
  const projectName = repoDir.split('/').pop()!;
  await expect(page.getByTestId(`project-${projectName}`)).toBeVisible();

  await page.getByTestId('worktree-main').click();
  await expect(page.getByTestId('chat-panel')).toBeVisible();

  // Phase 4: the worktree starts with zero sessions — create one via the CTA
  // before the composer becomes reachable.
  await expect(page.getByTestId('empty-sessions')).toBeVisible();
  await page.getByTestId('empty-sessions-cta').click();
  await expect(page.getByTestId('session-strip')).toBeVisible();

  const composer = page.getByTestId('composer-input');
  await composer.fill('Hello, fake-claude!');
  await composer.press('Enter');

  await expect(page.locator('[data-testid^="message-user-"]')).toBeVisible({ timeout: 3000 });

  const claudeMsg = page.locator('[data-testid^="message-claude-"]', {
    hasText: 'Hello from fake-claude in E2E.',
  });
  await expect(claudeMsg).toBeVisible({ timeout: 5000 });

  await app.close();
  rmSync(repoDir, { recursive: true, force: true });
  rmSync(storeCwd, { recursive: true, force: true });
});

test('session: kill button terminates a hanging session', async () => {
  const repoDir = initRepo();
  const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-store-'));
  const app = await launchJide({
    dialogReturnPath: repoDir,
    storeCwd,
    fakeClaudeScript: KILL_HANGS_SCRIPT,
  });
  const page = await app.firstWindow();

  await page.evaluate(() => window.jide.projects.add());
  await expect(page.getByTestId(`project-${repoDir.split('/').pop()}`)).toBeVisible();

  await page.getByTestId('worktree-main').click();
  await expect(page.getByTestId('chat-panel')).toBeVisible();

  // Phase 4: create the initial session via the EmptyState CTA.
  await expect(page.getByTestId('empty-sessions')).toBeVisible();
  await page.getByTestId('empty-sessions-cta').click();
  await expect(page.getByTestId('session-strip')).toBeVisible();

  await page.getByTestId('composer-input').fill('hello');
  await page.getByTestId('composer-input').press('Enter');

  // Wait for the first turn to complete (fake-claude emits result for turn 1).
  await expect(page.locator('[data-testid^="message-claude-"]').first()).toBeVisible({
    timeout: 5000,
  });

  // Now fake-claude is parked at echo-stdin; send a follow-up to drive the
  // session into a busy state without immediately producing a response.
  await page.getByTestId('composer-input').fill('follow up');
  await page.getByTestId('composer-input').press('Enter');

  await expect(page.getByTestId('chat-status')).toHaveText(/requesting|streaming|starting/i, {
    timeout: 3000,
  });

  await page.getByTestId('chat-kill').click();

  // Phase 4: the manager drops a session when its process exits, so the chip
  // disappears once the kill takes effect and EmptySessions reappears.
  await expect(page.locator('[role="tab"][data-testid^="session-chip-"]')).toHaveCount(0, {
    timeout: 5000,
  });
  await expect(page.getByTestId('empty-sessions')).toBeVisible();

  await app.close();
  rmSync(repoDir, { recursive: true, force: true });
  rmSync(storeCwd, { recursive: true, force: true });
});
