import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execaSync } from 'execa';
import { launchJide } from './helpers/launch';

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'jide-e2e-sidebar-'));
  execaSync('git', ['init', '--initial-branch=main', dir]);
  execaSync('git', ['-C', dir, 'config', 'user.email', 'e2e@jide.local']);
  execaSync('git', ['-C', dir, 'config', 'user.name', 'e2e']);
  execaSync('git', ['-C', dir, 'config', 'commit.gpgsign', 'false']);
  writeFileSync(join(dir, 'README.md'), '# r\n');
  execaSync('git', ['-C', dir, 'add', '-A']);
  execaSync('git', ['-C', dir, 'commit', '-m', 'init']);
  return dir;
}

test('sidebar reflects fs changes in under 1.5s', async () => {
  const repoDir = initRepo();
  const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-store-'));
  const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
  const page = await app.firstWindow();

  await page.evaluate(() => window.jide.projects.add());

  const basename = repoDir.split('/').pop()!;
  await expect(page.getByTestId(`project-${basename}`)).toBeVisible();
  await expect(page.getByTestId('worktree-main')).toBeVisible();

  await expect(page.getByTestId('worktree-changes-main')).not.toBeVisible();

  writeFileSync(join(repoDir, 'new.txt'), 'hi\n');

  await expect(page.getByTestId('worktree-changes-main')).toHaveText('1', { timeout: 1500 });

  await app.close();
  rmSync(repoDir, { recursive: true, force: true });
  rmSync(storeCwd, { recursive: true, force: true });
});

test('full flow: add project → create worktree via dialog → it appears in sidebar', async () => {
  const repoDir = initRepo();
  const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-store-'));
  const newWtPath = repoDir + '-feat-x';
  const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
  const page = await app.firstWindow();

  await page.evaluate(() => window.jide.projects.add());
  const basename = repoDir.split('/').pop()!;
  await expect(page.getByTestId(`project-${basename}`)).toBeVisible();

  await page.getByText('Nuevo worktree').click();
  await expect(page.getByTestId('new-worktree-dialog')).toBeVisible();

  await page.getByLabel('Rama nueva').check();
  await page.getByTestId('dialog-new-branch').fill('feat/x');
  await page.getByTestId('dialog-path').fill(newWtPath);
  await page.getByTestId('dialog-submit').click();

  await expect(page.getByTestId('worktree-feat/x')).toBeVisible({ timeout: 5000 });

  await app.close();
  rmSync(repoDir, { recursive: true, force: true });
  rmSync(newWtPath, { recursive: true, force: true });
  rmSync(storeCwd, { recursive: true, force: true });
});
