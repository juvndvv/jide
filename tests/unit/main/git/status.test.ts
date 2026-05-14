import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpRepo, type TmpRepo } from '../../helpers/tmp-repo';
import { worktreeStatus } from '../../../../src/main/git/status';

describe('worktreeStatus', () => {
  let repo: TmpRepo;
  beforeEach(() => {
    repo = tmpRepo();
    repo.writeFile('README.md', '# repo\n');
    repo.commit('initial');
  });
  afterEach(() => repo.cleanup());

  it('reports clean / 0 changes / 0 ahead / 0 behind on a fresh repo with no upstream', async () => {
    const s = await worktreeStatus(repo.cwd);
    expect(s).toEqual({ status: 'clean', changes: 0, ahead: 0, behind: 0 });
  });

  it('counts modified + untracked files (porcelain v1)', async () => {
    repo.writeFile('README.md', '# changed\n');
    repo.writeFile('new-file.ts', 'export {};\n');
    const s = await worktreeStatus(repo.cwd);
    expect(s.status).toBe('modified');
    expect(s.changes).toBe(2);
  });

  it('does not count ignored files', async () => {
    repo.writeFile('.gitignore', 'ignored.txt\n');
    repo.commit('add gitignore');
    repo.writeFile('ignored.txt', 'noise\n');
    const s = await worktreeStatus(repo.cwd);
    expect(s.changes).toBe(0);
  });

  it('returns ahead/behind against a configured upstream', async () => {
    const { execaSync } = await import('execa');
    const bareDir = repo.siblingPath('bare.git');
    execaSync('git', ['init', '--bare', bareDir]);
    repo.run('git', ['remote', 'add', 'origin', bareDir]);
    repo.run('git', ['push', '-u', 'origin', 'main']);

    repo.writeFile('a.txt', 'a\n');
    repo.commit('a');
    repo.writeFile('b.txt', 'b\n');
    repo.commit('b');

    const s = await worktreeStatus(repo.cwd);
    expect(s.ahead).toBe(2);
    expect(s.behind).toBe(0);
  });
});
