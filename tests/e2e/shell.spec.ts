import { test, expect } from '@playwright/test';
import { launchJide } from './helpers/launch';

test('shell renders top chrome, sidebar, tab bar and status bar', async () => {
  const app = await launchJide();
  const window = await app.firstWindow();
  await expect(window.getByTestId('top-chrome')).toBeVisible();
  await expect(window.getByTestId('sidebar')).toBeVisible();
  await expect(window.getByTestId('tab-bar')).toBeVisible();
  await expect(window.getByTestId('status-bar')).toBeVisible();
  await app.close();
});
