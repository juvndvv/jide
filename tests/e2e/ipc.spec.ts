import { test, expect } from '@playwright/test';
import { launchJide } from './helpers/launch';

test('window.jide.ping() returns "pong"', async () => {
  const app = await launchJide();
  const page = await app.firstWindow();
  const result = await page.evaluate(() => window.jide.ping());
  expect(result).toBe('pong');
  await app.close();
});
