import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpRepo, type TmpRepo } from '../../helpers/tmp-repo';
import { listBranches } from '../../../../src/main/git/branches';

describe('listBranches', () => {
  let repo: TmpRepo;
  beforeEach(() => {
    repo = tmpRepo();
    repo.writeFile('README.md', '# repo\n');
    repo.commit('initial');
  });
  afterEach(() => repo.cleanup());

  it('returns local branches sorted alphabetically', async () => {
    repo.run('git', ['branch', 'feat/b']);
    repo.run('git', ['branch', 'feat/a']);
    const branches = await listBranches(repo.cwd);
    expect(branches).toEqual(['feat/a', 'feat/b', 'main']);
  });

  it('returns just [main] in a fresh repo', async () => {
    const branches = await listBranches(repo.cwd);
    expect(branches).toEqual(['main']);
  });

  it('preserves deeply nested branch names verbatim', async () => {
    repo.run('git', ['branch', 'feat/foo/bar']);
    const branches = await listBranches(repo.cwd);
    expect(branches).toContain('feat/foo/bar');
  });

  it('returns [] when the repo has no commits and no branches', async () => {
    const empty = tmpRepo();
    try {
      expect(await listBranches(empty.cwd)).toEqual([]);
    } finally {
      empty.cleanup();
    }
  });
});
