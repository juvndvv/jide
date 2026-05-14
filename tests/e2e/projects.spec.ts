import { test, expect } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execaSync } from 'execa';
import { launchJide } from './helpers/launch';

test('projects: add via mocked dialog persists and is listed', async () => {
  const repoDir = mkdtempSync(join(tmpdir(), 'jide-e2e-repo-'));
  const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-store-'));
  execaSync('git', ['init', '--initial-branch=main', repoDir]);
  execaSync('git', ['-C', repoDir, 'config', 'user.email', 'e2e@jide.local']);
  execaSync('git', ['-C', repoDir, 'config', 'user.name', 'e2e']);
  execaSync('git', ['-C', repoDir, 'config', 'commit.gpgsign', 'false']);
  execaSync('git', ['-C', repoDir, 'commit', '--allow-empty', '-m', 'init']);

  const app = await launchJide({ dialogReturnPath: repoDir, storeCwd });
  const page = await app.firstWindow();

  const beforeList = await page.evaluate(() => window.jide.projects.list());
  expect(beforeList).toEqual([]);

  const added = await page.evaluate(() => window.jide.projects.add());
  const basename = repoDir.split('/').pop();
  expect(added?.path).toMatch(new RegExp(`${basename}$`));

  const afterList = await page.evaluate(() => window.jide.projects.list());
  expect(afterList).toHaveLength(1);
  expect(afterList[0]?.path).toBe(added?.path);

  await app.close();
});

test('projects: add returns null when the dialog is cancelled', async () => {
  const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-store-'));
  const app = await launchJide({ dialogReturnPath: '', storeCwd });
  const page = await app.firstWindow();
  const result = await page.evaluate(() => window.jide.projects.add());
  expect(result).toBeNull();
  await app.close();
});
