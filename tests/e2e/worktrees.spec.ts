import { test, expect } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execaSync } from 'execa';
import { launchJide } from './helpers/launch';

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'jide-e2e-wt-'));
  execaSync('git', ['init', '--initial-branch=main', dir]);
  execaSync('git', ['-C', dir, 'config', 'user.email', 'e2e@jide.local']);
  execaSync('git', ['-C', dir, 'config', 'user.name', 'e2e']);
  execaSync('git', ['-C', dir, 'config', 'commit.gpgsign', 'false']);
  writeFileSync(join(dir, 'README.md'), '# r\n');
  execaSync('git', ['-C', dir, 'add', '-A']);
  execaSync('git', ['-C', dir, 'commit', '-m', 'init']);
  return dir;
}

test('worktrees: list returns the primary worktree of an added project', async () => {
  const repoDir = initRepo();
  const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-store-'));
  const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
  const page = await app.firstWindow();

  const added = await page.evaluate(() => window.jide.projects.add());
  expect(added?.id).toBeTruthy();
  const id = added!.id;

  const wts = await page.evaluate((pid) => window.jide.worktrees.list(pid), id);
  expect(wts).toHaveLength(1);
  expect(wts[0]?.branch).toBe('main');

  await app.close();
});

test('worktrees: list-branches returns the local branches', async () => {
  const repoDir = initRepo();
  execaSync('git', ['-C', repoDir, 'branch', 'feat/a']);
  const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-store-'));
  const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
  const page = await app.firstWindow();

  const added = await page.evaluate(() => window.jide.projects.add());
  const id = added!.id;

  const branches = await page.evaluate((pid) => window.jide.worktrees.listBranches(pid), id);
  expect(branches.sort()).toEqual(['feat/a', 'main']);

  await app.close();
});

test('worktrees: add creates a new worktree off main', async () => {
  const repoDir = initRepo();
  const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-store-'));
  const newWtPath = repoDir + '-feat-x';
  const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
  const page = await app.firstWindow();

  const added = await page.evaluate(() => window.jide.projects.add());
  const id = added!.id;

  await page.evaluate(
    ({ pid, path }) =>
      window.jide.worktrees.add(pid, { branch: 'feat/x', baseBranch: 'main', path }),
    { pid: id, path: newWtPath },
  );

  const wts = await page.evaluate((pid) => window.jide.worktrees.list(pid), id);
  expect(wts.map((w) => w.branch).sort()).toEqual(['feat/x', 'main']);

  await app.close();
});
