import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpRepo, type TmpRepo } from '../../helpers/tmp-repo';
import {
  listWorktrees,
  parseWorktreeList,
  worktreeAdd,
  worktreeRemove,
} from '../../../../src/main/git/worktree';

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
    const secondary = repo.siblingPath('feat-x');
    repo.run('git', ['worktree', 'add', secondary, 'feat/x']);

    const wts = await listWorktrees(repo.cwd);
    expect(wts.map((w) => w.branch).sort()).toEqual(['feat/x', 'main']);
  });

  it('marks detached HEAD with branch=null', async () => {
    const sha = repo.run('git', ['rev-parse', 'HEAD']).trim();
    const detached = repo.siblingPath('detached');
    repo.run('git', ['worktree', 'add', '--detach', detached, sha]);

    const wts = await listWorktrees(repo.cwd);
    const det = wts.find((w) => w.path.endsWith('/detached'));
    expect(det?.branch).toBeNull();
  });
});

describe('parseWorktreeList — pure parser', () => {
  const sha = 'a'.repeat(40);

  it('returns [] for empty input', () => {
    expect(parseWorktreeList('')).toEqual([]);
  });

  it('parses a single primary entry block', () => {
    const input = `worktree /abs/path\nHEAD ${sha}\nbranch refs/heads/main`;
    const entries = parseWorktreeList(input);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      path: '/abs/path',
      head: sha,
      branch: 'main',
      detached: false,
      bare: false,
      locked: false,
    });
  });

  it('parses a bare repo block', () => {
    const input = `worktree /abs/bare\nbare`;
    const entries = parseWorktreeList(input);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      path: '/abs/bare',
      head: null,
      branch: null,
      detached: false,
      bare: true,
      locked: false,
    });
  });

  it('parses a detached HEAD block', () => {
    const input = `worktree /abs/det\nHEAD ${sha}\ndetached`;
    const entries = parseWorktreeList(input);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.detached).toBe(true);
    expect(entries[0]?.branch).toBeNull();
    expect(entries[0]?.head).toBe(sha);
  });

  it('parses a locked block with a reason', () => {
    const input = `worktree /abs/x\nHEAD ${sha}\nbranch refs/heads/feat/x\nlocked some reason`;
    const entries = parseWorktreeList(input);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.locked).toBe(true);
    expect(entries[0]?.branch).toBe('feat/x');
  });

  it('handles CRLF line endings identically to LF', () => {
    const input = `worktree /abs/path\r\nHEAD ${sha}\r\nbranch refs/heads/main`;
    const entries = parseWorktreeList(input);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      path: '/abs/path',
      head: sha,
      branch: 'main',
      detached: false,
      bare: false,
      locked: false,
    });
  });

  it('preserves spaces in worktree paths verbatim', () => {
    const input = `worktree /tmp/has spaces/repo\nHEAD ${sha}\nbranch refs/heads/main`;
    const entries = parseWorktreeList(input);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.path).toBe('/tmp/has spaces/repo');
  });

  it('parses two blocks separated by a blank line and preserves order', () => {
    const shaB = 'b'.repeat(40);
    const input =
      `worktree /abs/first\nHEAD ${sha}\nbranch refs/heads/main` +
      `\n\n` +
      `worktree /abs/second\nHEAD ${shaB}\nbranch refs/heads/feat/y`;
    const entries = parseWorktreeList(input);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.path).toBe('/abs/first');
    expect(entries[0]?.branch).toBe('main');
    expect(entries[1]?.path).toBe('/abs/second');
    expect(entries[1]?.branch).toBe('feat/y');
  });
});

describe('worktreeAdd / worktreeRemove (roundtrip)', () => {
  let repo: TmpRepo;
  beforeEach(() => {
    repo = tmpRepo();
    repo.writeFile('README.md', '# repo\n');
    repo.commit('initial');
  });
  afterEach(() => repo.cleanup());

  it('creates a new worktree on an existing branch', async () => {
    repo.run('git', ['branch', 'feat/y']);
    const target = repo.siblingPath('roundtrip-y');

    await worktreeAdd(repo.cwd, { branch: 'feat/y', path: target });

    const wts = await listWorktrees(repo.cwd);
    expect(wts.some((w) => w.branch === 'feat/y' && w.path.endsWith('/roundtrip-y'))).toBe(true);
  });

  it('creates a new worktree with a new branch (-b)', async () => {
    const target = repo.siblingPath('roundtrip-new');
    await worktreeAdd(repo.cwd, { branch: 'feat/new', baseBranch: 'main', path: target });

    const wts = await listWorktrees(repo.cwd);
    expect(wts.some((w) => w.branch === 'feat/new')).toBe(true);
  });

  it('removes a worktree cleanly', async () => {
    const target = repo.siblingPath('roundtrip-rm');
    await worktreeAdd(repo.cwd, { branch: 'feat/rm', baseBranch: 'main', path: target });
    await worktreeRemove(repo.cwd, target);

    const wts = await listWorktrees(repo.cwd);
    expect(wts.some((w) => w.path === target)).toBe(false);
  });
});
