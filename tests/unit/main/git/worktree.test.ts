import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpRepo, type TmpRepo } from '../../helpers/tmp-repo';
import { listWorktrees } from '../../../../src/main/git/worktree';

describe('listWorktrees', () => {
  let repo: TmpRepo;
  beforeEach(() => {
    repo = tmpRepo();
    repo.writeFile('README.md', '# repo\n');
    repo.commit('initial');
  });
  afterEach(() => repo.cleanup());

  it('returns the primary worktree alone right after init', async () => {
    const wts = await listWorktrees(repo.cwd);
    expect(wts).toHaveLength(1);
    expect(wts[0]?.branch).toBe('main');
    expect(typeof wts[0]?.path).toBe('string');
    expect(wts[0]?.path.length).toBeGreaterThan(0);
    expect(wts[0]?.head).toMatch(/^[a-f0-9]{40}$/);
  });

  it('returns two entries after `git worktree add`', async () => {
    repo.run('git', ['branch', 'feat/x']);
    const secondary = join(repo.cwd, '..', 'jide-test-feat-x');
    repo.run('git', ['worktree', 'add', secondary, 'feat/x']);

    const wts = await listWorktrees(repo.cwd);
    expect(wts.map((w) => w.branch).sort()).toEqual(['feat/x', 'main']);

    repo.run('git', ['worktree', 'remove', secondary]);
  });

  it('marks detached HEAD with branch=null', async () => {
    const sha = repo.run('git', ['rev-parse', 'HEAD']).trim();
    const detached = join(repo.cwd, '..', 'jide-test-detached');
    repo.run('git', ['worktree', 'add', '--detach', detached, sha]);

    const wts = await listWorktrees(repo.cwd);
    const det = wts.find((w) => w.path.endsWith('jide-test-detached'));
    expect(det?.branch).toBeNull();

    repo.run('git', ['worktree', 'remove', detached]);
  });
});
