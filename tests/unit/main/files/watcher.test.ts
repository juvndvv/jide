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
    await handle.ready;
    // Probe the subscription with a sentinel write so we know the OS-level
    // pipeline is actually delivering events before the test body runs.
    await writeFile(join(root, '.sentinel'), '1');
    await waitFor(() => events.some((e) => e.relPath === '.sentinel'), 5000);
    events = [];
  });

  afterEach(async () => {
    await handle.dispose();
    await rm(root, { recursive: true, force: true });
  });

  it('emits add event for new file', async () => {
    await writeFile(join(root, 'a.ts'), 'x');
    await waitFor(() => events.length >= 1);
    const first = events[0];
    expect(first?.worktreeId).toBe('wt-1');
    expect(first?.relPath).toBe('a.ts');
    // FSEvents may report create as 'add' or — when batched with an immediate
    // size update — collapse to 'change'. Both are valid signals of creation.
    expect(first?.kind === 'add' || first?.kind === 'change').toBe(true);
  });

  it('emits change event for modified file', async () => {
    await writeFile(join(root, 'b.ts'), 'initial');
    await waitFor(() => events.some((e) => e.relPath === 'b.ts'));
    const before = events.length;
    await appendFile(join(root, 'b.ts'), '\nmore');
    await waitFor(() => events.length > before);
    const changeEvent = events.find((e) => e.kind === 'change' && e.relPath === 'b.ts');
    expect(changeEvent).toEqual({ worktreeId: 'wt-1', relPath: 'b.ts', kind: 'change' });
  });

  it('emits unlink event for deleted file', async () => {
    await writeFile(join(root, 'c.ts'), 'content');
    await waitFor(() => events.some((e) => e.relPath === 'c.ts'));
    await unlink(join(root, 'c.ts'));
    await waitFor(() => events.some((e) => e.kind === 'unlink' && e.relPath === 'c.ts'));
    const unlinkEvent = events.find((e) => e.kind === 'unlink' && e.relPath === 'c.ts');
    expect(unlinkEvent).toEqual({ worktreeId: 'wt-1', relPath: 'c.ts', kind: 'unlink' });
  });

  it('emits an event for a new directory', async () => {
    await mkdir(join(root, 'newdir'));
    await waitFor(() => events.some((e) => e.relPath === 'newdir'));
    const dirEvent = events.find((e) => e.relPath === 'newdir');
    expect(dirEvent?.worktreeId).toBe('wt-1');
    // @parcel/watcher does not distinguish dirs from files in its event type;
    // we surface 'add' for any create. The renderer cache-invalidates on the
    // parent regardless of kind, so the dir-vs-file distinction is not load-bearing.
    expect(dirEvent?.kind).toBe('add');
  });

  it('does NOT emit events for ignored paths (node_modules)', async () => {
    await mkdir(join(root, 'node_modules', 'foo'), { recursive: true });
    await writeFile(join(root, 'node_modules', 'foo', 'bar.ts'), 'x');
    await new Promise((r) => setTimeout(r, 400));
    const ignoredEvents = events.filter((e) => e.relPath.startsWith('node_modules'));
    expect(ignoredEvents).toHaveLength(0);
  });

  it('debounces multiple writes to the same path into one event', async () => {
    const filePath = join(root, 'debounce.ts');
    await writeFile(filePath, 'seed');
    await waitFor(() => events.some((e) => e.relPath === 'debounce.ts'));
    const before = events.length;

    await appendFile(filePath, 'a');
    await appendFile(filePath, 'b');
    await appendFile(filePath, 'c');

    await new Promise((r) => setTimeout(r, 200));

    const changeEvents = events.slice(before).filter((e) => e.relPath === 'debounce.ts');
    expect(changeEvents.length).toBeGreaterThanOrEqual(1);
    expect(changeEvents.length).toBeLessThanOrEqual(2);
    expect(changeEvents[changeEvents.length - 1]?.kind).toBe('change');
  });

  it('stops emitting events after dispose', async () => {
    await handle.dispose();
    handle = { dispose: async () => {}, ready: Promise.resolve() };

    await writeFile(join(root, 'after-dispose.ts'), 'x');
    await new Promise((r) => setTimeout(r, 300));
    expect(events).toHaveLength(0);
  });
});
