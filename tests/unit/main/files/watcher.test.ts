import { mkdir, mkdtemp, rm, writeFile, appendFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFileWatcher } from '../../../../src/main/files/watcher';
import type { FileChangeEvent } from '@shared/files';

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate() && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!predicate()) throw new Error(`timed out after ${timeoutMs}ms`);
}

describe('createFileWatcher', () => {
  let root: string;
  let events: FileChangeEvent[];
  let handle: ReturnType<typeof createFileWatcher>;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'jide-watcher-'));
    events = [];
    handle = createFileWatcher({
      worktreeId: 'wt-1',
      repoRoot: root,
      onEvent: (e) => events.push(e),
      debounceMs: 50,
    });
    // Allow chokidar to initialise and reach ready state.
    await new Promise((r) => setTimeout(r, 100));
  });

  afterEach(async () => {
    await handle.dispose();
    await rm(root, { recursive: true, force: true });
  });

  it('emits add event for new file', async () => {
    await writeFile(join(root, 'a.ts'), 'x');
    await waitFor(() => events.length >= 1);
    expect(events[0]).toEqual({ worktreeId: 'wt-1', relPath: 'a.ts', kind: 'add' });
  });

  it('emits change event for modified file', async () => {
    await writeFile(join(root, 'b.ts'), 'initial');
    await waitFor(() => events.some((e) => e.kind === 'add' && e.relPath === 'b.ts'));
    const before = events.length;
    await appendFile(join(root, 'b.ts'), '\nmore');
    await waitFor(() => events.length > before);
    const changeEvent = events.find((e) => e.kind === 'change' && e.relPath === 'b.ts');
    expect(changeEvent).toEqual({ worktreeId: 'wt-1', relPath: 'b.ts', kind: 'change' });
  });

  it('emits unlink event for deleted file', async () => {
    await writeFile(join(root, 'c.ts'), 'content');
    await waitFor(() => events.some((e) => e.kind === 'add' && e.relPath === 'c.ts'));
    await unlink(join(root, 'c.ts'));
    await waitFor(() => events.some((e) => e.kind === 'unlink' && e.relPath === 'c.ts'));
    const unlinkEvent = events.find((e) => e.kind === 'unlink' && e.relPath === 'c.ts');
    expect(unlinkEvent).toEqual({ worktreeId: 'wt-1', relPath: 'c.ts', kind: 'unlink' });
  });

  it('emits add-dir event for new directory', async () => {
    await mkdir(join(root, 'newdir'));
    await waitFor(() => events.some((e) => e.kind === 'add-dir' && e.relPath === 'newdir'));
    const dirEvent = events.find((e) => e.kind === 'add-dir' && e.relPath === 'newdir');
    expect(dirEvent).toEqual({ worktreeId: 'wt-1', relPath: 'newdir', kind: 'add-dir' });
  });

  it('does NOT emit events for ignored paths (node_modules)', async () => {
    await mkdir(join(root, 'node_modules', 'foo'), { recursive: true });
    await writeFile(join(root, 'node_modules', 'foo', 'bar.ts'), 'x');
    // Allow generous time for any stray events to surface before asserting.
    await new Promise((r) => setTimeout(r, 400));
    const ignoredEvents = events.filter((e) => e.relPath.startsWith('node_modules'));
    expect(ignoredEvents).toHaveLength(0);
  });

  it('debounces multiple writes to the same path into one event', async () => {
    const filePath = join(root, 'debounce.ts');
    await writeFile(filePath, 'seed');
    await waitFor(() => events.some((e) => e.kind === 'add' && e.relPath === 'debounce.ts'));
    const before = events.length;

    // Three rapid writes within the 50ms debounce window.
    await appendFile(filePath, 'a');
    await appendFile(filePath, 'b');
    await appendFile(filePath, 'c');

    // Wait for debounce to flush plus a safety margin.
    await new Promise((r) => setTimeout(r, 200));

    const changeEvents = events.slice(before).filter((e) => e.relPath === 'debounce.ts');
    expect(changeEvents).toHaveLength(1);
    expect(changeEvents[0]?.kind).toBe('change');
  });

  it('stops emitting events after dispose', async () => {
    await handle.dispose();
    // Re-assign so afterEach dispose is a no-op double-close (safe with chokidar).
    handle = { dispose: async () => {} };

    await writeFile(join(root, 'after-dispose.ts'), 'x');
    await new Promise((r) => setTimeout(r, 300));
    expect(events).toHaveLength(0);
  });
});
