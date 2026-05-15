import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execaSync } from 'execa';
import { launchJide } from './helpers/launch';

const here = dirname(fileURLToPath(import.meta.url));
const echoShell = resolve(here, '../fixtures/echo-shell.mjs');

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'jide-e2e-term-'));
  execaSync('git', ['init', '--initial-branch=main', dir]);
  execaSync('git', ['-C', dir, 'config', 'user.email', 'e2e@jide.local']);
  execaSync('git', ['-C', dir, 'config', 'user.name', 'e2e']);
  execaSync('git', ['-C', dir, 'config', 'commit.gpgsign', 'false']);
  writeFileSync(join(dir, 'README.md'), '# r\n');
  execaSync('git', ['-C', dir, 'add', '-A']);
  execaSync('git', ['-C', dir, 'commit', '-m', 'init']);
  return dir;
}

test.describe('terminal panel', () => {
  test('⌘\\ opens the terminal panel', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-term-store-'));
    const app = await launchJide({
      dialogReturnPath: repoDir,
      storeCwd,
      testPtyBin: echoShell,
    });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    // Terminal should not be visible before toggling
    await expect(page.getByTestId('terminal-panel')).not.toBeVisible();

    // Press ⌘\ to open terminal (cycles off → bottom)
    await page.keyboard.press('Meta+Backslash');
    await expect(page.getByTestId('terminal-panel')).toBeVisible({ timeout: 5000 });

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('⌘\\ cycles terminal: off → bottom → side → off', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-term-store-'));
    const app = await launchJide({
      dialogReturnPath: repoDir,
      storeCwd,
      testPtyBin: echoShell,
    });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    // off → bottom: terminal appears in a horizontal split (column flex direction)
    await page.keyboard.press('Meta+Backslash');
    await expect(page.getByTestId('terminal-panel')).toBeVisible({ timeout: 5000 });

    const splitContainer = page.getByTestId('split-container').first();
    await expect(splitContainer).toBeVisible();
    const bottomFlexDir = await splitContainer.evaluate(
      (el) => (el as HTMLElement).style.flexDirection,
    );
    expect(bottomFlexDir).toBe('column');

    // bottom → side: split becomes vertical (row flex direction)
    await page.keyboard.press('Meta+Backslash');
    await expect(page.getByTestId('terminal-panel')).toBeVisible({ timeout: 3000 });

    const sideFlexDir = await splitContainer.evaluate(
      (el) => (el as HTMLElement).style.flexDirection,
    );
    expect(sideFlexDir).toBe('row');

    // side → off: terminal disappears
    await page.keyboard.press('Meta+Backslash');
    await expect(page.getByTestId('terminal-panel')).not.toBeVisible({ timeout: 3000 });

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('toggle orientation button switches from bottom to side', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-term-store-'));
    const app = await launchJide({
      dialogReturnPath: repoDir,
      storeCwd,
      testPtyBin: echoShell,
    });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    // Open terminal in bottom orientation
    await page.keyboard.press('Meta+Backslash');
    await expect(page.getByTestId('terminal-panel')).toBeVisible({ timeout: 5000 });

    const splitContainer = page.getByTestId('split-container').first();
    const initialFlexDir = await splitContainer.evaluate(
      (el) => (el as HTMLElement).style.flexDirection,
    );
    expect(initialFlexDir).toBe('column');

    // Click the orientation toggle button in the terminal header
    await page.getByLabel('Cambiar orientación del terminal').click();

    // Now it should be side orientation (row flex direction)
    await expect
      .poll(
        async () =>
          splitContainer.evaluate((el) => (el as HTMLElement).style.flexDirection),
        { timeout: 3000 },
      )
      .toBe('row');

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('echo-shell renders prompt and echoes typed input', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-term-store-'));
    const app = await launchJide({
      dialogReturnPath: repoDir,
      storeCwd,
      testPtyBin: echoShell,
    });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    // Open terminal
    await page.keyboard.press('Meta+Backslash');
    await expect(page.getByTestId('terminal-panel')).toBeVisible({ timeout: 5000 });

    // Wait for the echo-shell prompt '>' to appear in the xterm DOM rows.
    // xterm v5/v6 maintains .xterm-rows as an accessibility shadow DOM.
    const xtermRows = page.locator('[data-testid="terminal-panel"] .xterm-rows');

    await expect
      .poll(
        async () => {
          const rows = await xtermRows.locator('> div').allTextContents();
          return rows.join('\n');
        },
        { timeout: 8000 },
      )
      .toContain('>');

    // Focus the xterm helper textarea and type a command
    const helperTextarea = page.locator(
      '[data-testid="terminal-panel"] .xterm-helper-textarea',
    );
    await helperTextarea.focus();
    await page.keyboard.type('hello');

    // The echo-shell echoes each character back — wait for it to appear
    await expect
      .poll(
        async () => {
          const rows = await xtermRows.locator('> div').allTextContents();
          return rows.join('\n');
        },
        { timeout: 5000 },
      )
      .toContain('hello');

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });
});
