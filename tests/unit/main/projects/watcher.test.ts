import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpRepo, type TmpRepo } from '../../helpers/tmp-repo';
import { createWatcher } from '../../../../src/main/projects/watcher';
import type { Worktree } from '../../../../src/shared/project';

type ChangePayload = { projectId: string; worktree: Worktree };

describe('Watcher', () => {
  let repo: TmpRepo;
  beforeEach(() => {
    repo = tmpRepo();
    repo.writeFile('README.md', '# x\n');
    repo.commit('initial');
  });
  afterEach(() => repo.cleanup());

  it('emits one event per worktree after a debounced burst of fs changes', async () => {
    const onChange = vi.fn<(payload: ChangePayload) => void>();
    const watcher = createWatcher({
      projectId: 'p1',
      repoRoot: repo.cwd,
      onChange,
      debounceMs: 100,
    });

    // Give chokidar a moment to set up watches before we modify files.
    await new Promise((r) => setTimeout(r, 200));

    writeFileSync(join(repo.cwd, 'a.txt'), 'a\n');
    writeFileSync(join(repo.cwd, 'b.txt'), 'b\n');

    await new Promise((r) => setTimeout(r, 500));

    expect(onChange).toHaveBeenCalledTimes(1);
    const call = onChange.mock.calls[0];
    expect(call).toBeDefined();
    const [{ projectId, worktree }] = call!;
    expect(projectId).toBe('p1');
    expect(worktree.changes).toBe(2);

    await watcher.dispose();
  });

  it('ignores changes inside .git/', async () => {
    const onChange = vi.fn<(payload: ChangePayload) => void>();
    const watcher = createWatcher({
      projectId: 'p1',
      repoRoot: repo.cwd,
      onChange,
      debounceMs: 100,
    });

    await new Promise((r) => setTimeout(r, 200));

    writeFileSync(join(repo.cwd, '.git', 'FETCH_HEAD'), 'noise\n');

    await new Promise((r) => setTimeout(r, 300));
    expect(onChange).not.toHaveBeenCalled();
    await watcher.dispose();
  });
});
