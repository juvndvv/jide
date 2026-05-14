import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execaSync } from 'execa';
import { launchJide } from './helpers/launch';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT_A = resolve(here, '../fixtures/claude-events/multi-session-a.script.json');

function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'jide-e2e-split-'));
  execaSync('git', ['init', '--initial-branch=main', dir]);
  execaSync('git', ['-C', dir, 'config', 'user.email', 'e2e@jide.local']);
  execaSync('git', ['-C', dir, 'config', 'user.name', 'e2e']);
  execaSync('git', ['-C', dir, 'config', 'commit.gpgsign', 'false']);
  writeFileSync(join(dir, 'README.md'), '# r\n');
  execaSync('git', ['-C', dir, 'add', '-A']);
  execaSync('git', ['-C', dir, 'commit', '-m', 'init']);
  return dir;
}

test.describe('chat pane splitting', () => {
  test('split horizontal shows a second empty pane', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-split-store-'));
    const app = await launchJide({
      dialogReturnPath: repoDir,
      storeCwd,
      fakeClaudeScript: SCRIPT_A,
    });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    // Create an initial session
    await expect(page.getByTestId('empty-sessions')).toBeVisible();
    await page.getByTestId('empty-sessions-cta').click();
    await expect(page.locator('[role="tab"][data-testid^="session-chip-"]')).toHaveCount(1);

    // Initially only 1 pane-header is visible
    await expect(page.getByTestId('pane-header')).toHaveCount(1);
    // pane-empty should not be visible when a session exists
    await expect(page.getByTestId('pane-empty')).toHaveCount(0);

    // Click "Dividir abajo" (split horizontal) on the first pane header
    await page.getByTestId('pane-header').first().getByLabel('Dividir abajo').click();

    // Now we should have 2 pane headers
    await expect(page.getByTestId('pane-header')).toHaveCount(2);

    // The second (new) pane should show the empty state
    await expect(page.getByTestId('pane-empty')).toBeVisible();

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('drag session chip into empty pane assigns the session', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-split-store-'));
    const app = await launchJide({
      dialogReturnPath: repoDir,
      storeCwd,
      fakeClaudeScript: SCRIPT_A,
    });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    // Create an initial session and send a message so there is content to show
    await page.getByTestId('empty-sessions-cta').click();
    await expect(page.locator('[role="tab"][data-testid^="session-chip-"]')).toHaveCount(1);

    // Verify the session is assigned to the pane (no pane-empty)
    await expect(page.getByTestId('pane-empty')).toHaveCount(0);

    // Split the pane to get an empty second pane
    await page.getByTestId('pane-header').first().getByLabel('Dividir abajo').click();
    // Wait for 2 pane headers, then check for exactly 1 pane-empty
    await expect(page.getByTestId('pane-header')).toHaveCount(2);
    await expect(page.getByTestId('pane-empty')).toHaveCount(1);

    // Playwright cannot reliably simulate HTML5 drag-and-drop with custom MIME types
    // in Electron due to DataTransfer restrictions. We directly invoke the React
    // onDrop handler by traversing the fiber tree from the drop target element.
    const chip = page.locator('[role="tab"][data-testid^="session-chip-"]').first();
    const chipTestId = await chip.getAttribute('data-testid');
    const sessionUuid = chipTestId?.replace('session-chip-', '') ?? '';

    // Playwright cannot reliably simulate HTML5 drag-and-drop with custom MIME types
    // in Electron due to DataTransfer security restrictions. We invoke the React
    // onDrop handler directly via the fiber tree, bypassing the event system.
    await page.evaluate(
      (uuid) => {
        const MIME = 'application/x-jide-session';
        const targets = document.querySelectorAll('[data-testid="pane-drop-target"]');
        const target = targets[targets.length - 1];
        if (!target) return;
        const key = Object.keys(target).find((k) => k.startsWith('__reactFiber'));
        if (!key) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        let fiber: { memoizedProps: Record<string, unknown> | null; return: unknown } = (target as any)[key];
        while (fiber) {
          const props = fiber.memoizedProps;
          if (props?.onDrop && typeof props.onDrop === 'function') {
            const mockEvent = {
              dataTransfer: { getData: (type: string) => (type === MIME ? uuid : '') },
              preventDefault: () => {},
            };
            (props.onDrop as (e: unknown) => void)(mockEvent);
            return;
          }
          fiber = fiber.return as typeof fiber;
        }
      },
      sessionUuid,
    );

    // Move-semantics: after the drag, the originally-assigned pane becomes empty
    // (the session moved into the previously empty pane). So pane-empty count is still 1,
    // but in the other pane than before.
    await expect(page.getByTestId('pane-empty')).toHaveCount(1);

    // The first pane (originally holding the session) is now the empty one.
    const firstPaneEmpty = page.getByTestId('pane-header').first().locator('..').getByTestId('pane-empty');
    await expect(firstPaneEmpty).toBeVisible();

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });

  test('close a split pane merges back to a single pane', async () => {
    const repoDir = initRepo();
    const storeCwd = mkdtempSync(join(tmpdir(), 'jide-e2e-split-store-'));
    const app = await launchJide({
      dialogReturnPath: repoDir,
      storeCwd,
      fakeClaudeScript: SCRIPT_A,
    });
    const page = await app.firstWindow();

    await page.evaluate(() => window.jide.projects.add());
    await page.getByTestId('worktree-main').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    await page.getByTestId('empty-sessions-cta').click();
    await expect(page.locator('[role="tab"][data-testid^="session-chip-"]')).toHaveCount(1);

    // Split: 1 → 2 panes
    await page.getByTestId('pane-header').first().getByLabel('Dividir abajo').click();
    await expect(page.getByTestId('pane-header')).toHaveCount(2);

    // Close the second pane via "Cerrar panel"
    await page.getByTestId('pane-header').nth(1).getByLabel('Cerrar panel').click();

    // Back to 1 pane
    await expect(page.getByTestId('pane-header')).toHaveCount(1);

    await app.close();
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(storeCwd, { recursive: true, force: true });
  });
});
