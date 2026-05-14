import { test, expect } from '@playwright/test';
import { launchJide } from './helpers/launch';

test('app boots and opens a window titled "jide"', async () => {
  const app = await launchJide();
  const window = await app.firstWindow();
  await expect(window).toHaveTitle('jide');
  await app.close();
});

test('renderer shows the sidebar shell', async () => {
  const app = await launchJide();
  const window = await app.firstWindow();
  await expect(window.getByTestId('sidebar')).toBeVisible();
  await app.close();
});
