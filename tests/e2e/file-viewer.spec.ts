import { test, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execaSync } from 'execa';
import { launchJide } from './helpers/launch';

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'jide-e2e-viewer-'));
  execaSync('git', ['init', '--initial-branch=main', dir]);
  execaSync('git', ['-C', dir, 'config', 'user.email', 'e2e@jide.local']);
  execaSync('git', ['-C', dir, 'config', 'user.name', 'e2e']);
  execaSync('git', ['-C', dir, 'config', 'commit.gpgsign', 'false']);
  return dir;
}

async function openViewerInWorktree(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof launchJide>>['firstWindow']>>,
): Promise<void> {
  await page.keyboard.press('Meta+o');
  await expect(page.getByTestId('file-viewer-panel')).toBeVisible({ timeout: 5000 });
}

test.describe('file viewer', () => {
  test('⌘O toggles the file viewer panel', async () => {
    const repoDir = initRepo();
    writeFileSync(join(repoDir, 'README.md'), '# r\n');
    execaSync('git', ['-C', repoDir, 'add', '-A']);
    execaSync('git', ['-C', repoDir, 'commit', '-m', 'init']);

    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-viewer-store-'));
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    await page.keyboard.press('Meta+o');
    await expect(page.getByTestId('file-viewer-panel')).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Meta+o');
    await expect(page.getByTestId('file-viewer-panel')).toHaveCount(0);

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('StatusBar Visor button toggles the file viewer panel', async () => {
    const repoDir = initRepo();
    writeFileSync(join(repoDir, 'README.md'), '# r\n');
    execaSync('git', ['-C', repoDir, 'add', '-A']);
    execaSync('git', ['-C', repoDir, 'commit', '-m', 'init']);

    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-viewer-store-'));
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    await expect(page.getByTestId('status-viewer-button')).toBeVisible();

    await page.getByTestId('status-viewer-button').click();
    await expect(page.getByTestId('file-viewer-panel')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('status-viewer-button').click();
    await expect(page.getByTestId('file-viewer-panel')).toHaveCount(0);

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('tree filters ignored paths', async () => {
    const repoDir = initRepo();
    mkdirSync(join(repoDir, 'src'));
    writeFileSync(join(repoDir, 'src', 'foo.ts'), 'export const X = 1;\n');
    writeFileSync(join(repoDir, 'README.md'), '# r\n');
    mkdirSync(join(repoDir, 'node_modules', 'x'), { recursive: true });
    writeFileSync(join(repoDir, 'node_modules', 'x', 'y.ts'), 'export {};\n');
    mkdirSync(join(repoDir, 'dist'));
    writeFileSync(join(repoDir, 'dist', 'output.js'), 'console.log(1);\n');
    execaSync('git', ['-C', repoDir, 'add', '-A']);
    execaSync('git', ['-C', repoDir, 'commit', '-m', 'init']);

    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-viewer-store-'));
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    await openViewerInWorktree(page);

    await expect(
      page.locator('[data-testid="file-tree-node"][data-rel-path="src"]'),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('[data-testid="file-tree-node"][data-rel-path="README.md"]'),
    ).toBeVisible();

    await expect(
      page.locator('[data-testid="file-tree-node"][data-rel-path="node_modules"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="file-tree-node"][data-rel-path="dist"]'),
    ).toHaveCount(0);

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('expand directory and select file shows content', async () => {
    const repoDir = initRepo();
    mkdirSync(join(repoDir, 'src'));
    writeFileSync(join(repoDir, 'src', 'foo.ts'), 'export const X = 1;\n');
    writeFileSync(join(repoDir, 'README.md'), '# r\n');
    execaSync('git', ['-C', repoDir, 'add', '-A']);
    execaSync('git', ['-C', repoDir, 'commit', '-m', 'init']);

    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-viewer-store-'));
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    await openViewerInWorktree(page);

    await expect(
      page.locator('[data-testid="file-tree-node"][data-rel-path="src"]'),
    ).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="file-tree-node"][data-rel-path="src"]').click();

    await expect(
      page.locator('[data-testid="file-tree-node"][data-rel-path="src/foo.ts"]'),
    ).toBeVisible({ timeout: 3000 });

    await page.locator('[data-testid="file-tree-node"][data-rel-path="src/foo.ts"]').click();

    await expect(page.locator('[data-testid="file-viewer-panel"]')).toContainText(
      'export const X = 1;',
      { timeout: 8000 },
    );

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('external write refreshes the open file', async () => {
    const repoDir = initRepo();
    writeFileSync(join(repoDir, 'foo.ts'), 'export const VERSION = 1;\n');
    execaSync('git', ['-C', repoDir, 'add', '-A']);
    execaSync('git', ['-C', repoDir, 'commit', '-m', 'init']);

    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-viewer-store-'));
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    await openViewerInWorktree(page);

    await expect(
      page.locator('[data-testid="file-tree-node"][data-rel-path="foo.ts"]'),
    ).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="file-tree-node"][data-rel-path="foo.ts"]').click();

    await expect(page.locator('[data-testid="file-viewer-panel"]')).toContainText(
      'VERSION = 1',
      { timeout: 8000 },
    );

    writeFileSync(join(repoDir, 'foo.ts'), 'export const VERSION = 42;\n');

    await expect(page.locator('[data-testid="file-viewer-panel"]')).toContainText(
      'VERSION = 42',
      { timeout: 6000 },
    );

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('binary file shows placeholder', async () => {
    const repoDir = initRepo();
    // PNG magic bytes: \x89PNG\r\n\x1a\n
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    writeFileSync(join(repoDir, 'image.png'), pngMagic);
    writeFileSync(join(repoDir, 'README.md'), '# r\n');
    execaSync('git', ['-C', repoDir, 'add', '-A']);
    execaSync('git', ['-C', repoDir, 'commit', '-m', 'init']);

    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-viewer-store-'));
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    await openViewerInWorktree(page);

    await expect(
      page.locator('[data-testid="file-tree-node"][data-rel-path="image.png"]'),
    ).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="file-tree-node"][data-rel-path="image.png"]').click();

    await expect(page.locator('[data-testid="file-viewer-panel"]')).toContainText(
      'Archivo binario',
      { timeout: 8000 },
    );

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('path traversal returns null via openInViewer IPC', async () => {
    const repoDir = initRepo();
    writeFileSync(join(repoDir, 'README.md'), '# r\n');
    execaSync('git', ['-C', repoDir, 'add', '-A']);
    execaSync('git', ['-C', repoDir, 'commit', '-m', 'init']);

    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-viewer-store-'));
    const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
    const page = await app.firstWindow();

    const added = await page.evaluate(() => window.jide.projects.add());
    const projectId = (added as { id: string }).id;
    const wts = await page.evaluate(
      (pid: string) => window.jide.worktrees.list(pid),
      projectId,
    );
    const worktreeId = (wts as Array<{ id: string }>)[0]!.id;

    const result = await page.evaluate(
      ([wid, path]: [string, string]) => window.jide.files.openInViewer(wid, path),
      [worktreeId, '../../etc/passwd'] as [string, string],
    );

    expect(result).toBeNull();

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('viewer state persists across relaunch', async () => {
    const repoDir = initRepo();
    writeFileSync(join(repoDir, 'foo.ts'), 'export const X = 1;\n');
    writeFileSync(join(repoDir, 'README.md'), '# r\n');
    execaSync('git', ['-C', repoDir, 'add', '-A']);
    execaSync('git', ['-C', repoDir, 'commit', '-m', 'init']);

    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-viewer-store-'));

    {
      const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
      const page = await app.firstWindow();

      await page.evaluate(() => window.jide.projects.add());
      await page.getByTestId('worktree-main').click();
      await expect(page.getByTestId('chat-panel')).toBeVisible();

      await openViewerInWorktree(page);

      await expect(
        page.locator('[data-testid="file-tree-node"][data-rel-path="foo.ts"]'),
      ).toBeVisible({ timeout: 5000 });

      await page.locator('[data-testid="file-tree-node"][data-rel-path="foo.ts"]').click();

      await expect(page.locator('[data-testid="file-viewer-panel"]')).toContainText(
        'export const X = 1;',
        { timeout: 8000 },
      );

      // Allow layout persist debounce to flush (200 ms + margin)
      await page.waitForTimeout(400);

      await app.close();
    }

    {
      const app2 = await launchJide({ dialogReturnPath: repoDir, storeCwd });
      const page2 = await app2.firstWindow();

      await page2.getByTestId('worktree-main').click();

      await expect(page2.getByTestId('file-viewer-panel')).toBeVisible({ timeout: 8000 });

      await expect(
        page2.locator('[data-testid="file-tree-node"][data-rel-path="foo.ts"]'),
      ).toBeVisible({ timeout: 5000 });

      await app2.close();
    }

    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  // TODO: Tool message "Abrir" button — requires a tool message in the chat with file_path.
  // The fake-claude script records do not include a tool-call with a file_path result,
  // so this case is skipped at the E2E level. The unit-level spec (useFileContent,
  // OpenFileContext) already covers the wiring.
  test.skip('tool message Abrir button opens file in viewer', async () => {});

  // TODO: Git status M badge — requires a committed file plus an external modification
  // tracked by git. The added setup (commit, modify, wait for watcher + status refresh)
  // is significant and the badge is already covered by unit tests for loadStatus.
  // Skipped here to keep the E2E suite fast and stable.
  test.skip('git status M badge appears on modified file node', async () => {});
});
