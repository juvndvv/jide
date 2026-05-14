import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpRepo, type TmpRepo } from '../../helpers/tmp-repo';
import { tmpStoreDir } from '../../helpers/tmp-store';
import { createStore, type JideStore } from '../../../../src/main/store/index';
import { createProjectRegistry } from '../../../../src/main/projects/index';

describe('ProjectRegistry', () => {
  let repo: TmpRepo;
  let storeCwd: string;
  let storeCleanup: () => void;
  let store: JideStore;

  beforeEach(() => {
    repo = tmpRepo();
    repo.writeFile('README.md', '# x\n');
    repo.commit('initial');
    ({ cwd: storeCwd, cleanup: storeCleanup } = tmpStoreDir());
    store = createStore({ cwd: storeCwd });
  });
  afterEach(() => {
    repo.cleanup();
    storeCleanup();
  });

  it('adds a project from a valid git path', async () => {
    const reg = createProjectRegistry(store);
    const project = await reg.add(repo.cwd);
    expect(project.path.endsWith(repo.cwd.split('/').pop()!)).toBe(true);
    expect(project.name).toBe(repo.cwd.split('/').pop());
    expect(reg.list()).toHaveLength(1);
  });

  it('rejects a path that does not exist', async () => {
    const reg = createProjectRegistry(store);
    await expect(reg.add('/this/path/does/not/exist')).rejects.toThrow(/does not exist|ENOENT/i);
  });

  it('rejects a path that is not a git repository', async () => {
    const reg = createProjectRegistry(store);
    // Use the test's own tmpStoreDir (guaranteed non-git directory) instead of '/tmp'
    // because '/tmp' could be a git repo on dev machines that test git tooling.
    await expect(reg.add(storeCwd)).rejects.toThrow(/not a git/i);
  });

  it('rejects adding the same project twice (by canonical path)', async () => {
    const reg = createProjectRegistry(store);
    await reg.add(repo.cwd);
    await expect(reg.add(repo.cwd)).rejects.toThrow(/already added/i);
  });

  it('persists across instances', async () => {
    const a = createProjectRegistry(store);
    await a.add(repo.cwd);
    const b = createProjectRegistry(store);
    expect(b.list()).toHaveLength(1);
  });

  it('removes a project by id', async () => {
    const reg = createProjectRegistry(store);
    const p = await reg.add(repo.cwd);
    reg.remove(p.id);
    expect(reg.list()).toHaveLength(0);
  });
});
