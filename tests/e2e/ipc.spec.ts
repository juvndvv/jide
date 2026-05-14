import { test, expect } from '@playwright/test';
import { launchJide } from './helpers/launch';

test('window.jide.ping() returns "pong"', async () => {
  const app = await launchJide();
  const page = await app.firstWindow();
  const result = await page.evaluate(() => window.jide.ping());
  expect(result).toBe('pong');
  await app.close();
});

test('settings: write then read returns the same value', async () => {
  const app = await launchJide();
  const page = await app.firstWindow();

  const before = await page.evaluate(() => window.jide.settings.get('theme'));
  expect(['auto', 'light', 'dark']).toContain(before);

  await page.evaluate(() => window.jide.settings.set('theme', 'dark'));
  const after = await page.evaluate(() => window.jide.settings.get('theme'));
  expect(after).toBe('dark');

  await app.close();
});
