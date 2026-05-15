import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveWithinRoot, searchFiles } from '../../../../src/main/ipc/files';

const root = sep === '/' ? '/project/repo' : 'C:\\project\\repo';

describe('resolveWithinRoot', () => {
  it('returns null for a relative path that escapes with ../', async () => {
    expect(await resolveWithinRoot(root, '../etc')).toBeNull();
  });

  it('returns null for a deeply nested escape: src/../../etc', async () => {
    expect(await resolveWithinRoot(root, 'src/../../etc')).toBeNull();
  });

  it('returns null for an absolute path outside the root', async () => {
    const outside = sep === '/' ? '/etc/passwd' : 'C:\\Windows\\system32\\drivers\\etc\\hosts';
    expect(await resolveWithinRoot(root, outside)).toBeNull();
  });

  it('returns null when the resolved path equals the root itself', async () => {
    expect(await resolveWithinRoot(root, '.')).toBeNull();
  });

  it('accepts a relative path inside the root and returns the correct abs + rel', async () => {
    const result = await resolveWithinRoot(root, 'src/index.ts');
    expect(result).not.toBeNull();
    expect(result!.rel).toBe('src/index.ts');
  });

  it('accepts an absolute path inside the root', async () => {
    const inside = sep === '/' ? '/project/repo/src/foo.ts' : 'C:\\project\\repo\\src\\foo.ts';
    const result = await resolveWithinRoot(root, inside);
    expect(result).not.toBeNull();
    expect(result!.rel).toBe('src/foo.ts');
  });

  it('returns a POSIX relPath even on Windows (uses forward slashes)', async () => {
    const result = await resolveWithinRoot(root, 'a/b/c.ts');
    expect(result).not.toBeNull();
    expect(result!.rel).not.toContain('\\');
    expect(result!.rel).toBe('a/b/c.ts');
  });

  it('returns null for a bare .. input', async () => {
    expect(await resolveWithinRoot(root, '..')).toBeNull();
  });

  it('rejects paths that resolve via symlink to outside the root', async () => {
    const testRoot = await mkdtemp(join(tmpdir(), 'jide-resolve-'));
    const escape = await mkdtemp(join(tmpdir(), 'jide-escape-'));
    await writeFile(join(escape, 'secret.txt'), 'leaked');
    await symlink(join(escape, 'secret.txt'), join(testRoot, 'evil-link'));
    const result = await resolveWithinRoot(testRoot, 'evil-link');
    expect(result).toBeNull();
    await rm(testRoot, { recursive: true, force: true });
    await rm(escape, { recursive: true, force: true });
  });

  it('accepts paths that resolve via symlink INSIDE the root', async () => {
    const testRoot = await mkdtemp(join(tmpdir(), 'jide-resolve-'));
    await mkdir(join(testRoot, 'pkg'), { recursive: true });
    await writeFile(join(testRoot, 'pkg', 'real.ts'), 'x');
    await symlink(join(testRoot, 'pkg', 'real.ts'), join(testRoot, 'alias.ts'));
    const result = await resolveWithinRoot(testRoot, 'alias.ts');
    expect(result).not.toBeNull();
    expect(result!.rel).toBe('pkg/real.ts');
    await rm(testRoot, { recursive: true, force: true });
  });
});

describe('searchFiles', () => {
  it('returns an empty array for an empty query', async () => {
    const testRoot = await mkdtemp(join(tmpdir(), 'jide-search-'));
    await writeFile(join(testRoot, 'a.ts'), 'x');
    const result = await searchFiles(testRoot, '', 10);
    expect(result).toEqual([]);
    await rm(testRoot, { recursive: true, force: true });
  });

  it('matches files recursively by name (case-insensitive)', async () => {
    const testRoot = await mkdtemp(join(tmpdir(), 'jide-search-'));
    await mkdir(join(testRoot, 'src', 'main'), { recursive: true });
    await writeFile(join(testRoot, 'src', 'main', 'Foo.ts'), 'x');
    await writeFile(join(testRoot, 'src', 'other.ts'), 'x');
    const result = await searchFiles(testRoot, 'foo', 10);
    expect(result.map((r) => r.relPath)).toContain('src/main/Foo.ts');
    expect(result.find((r) => r.relPath === 'src/main/Foo.ts')?.name).toBe('Foo.ts');
    await rm(testRoot, { recursive: true, force: true });
  });

  it('matches by relPath substring even when file name does not match', async () => {
    const testRoot = await mkdtemp(join(tmpdir(), 'jide-search-'));
    await mkdir(join(testRoot, 'utils', 'nested'), { recursive: true });
    await writeFile(join(testRoot, 'utils', 'nested', 'plain.ts'), 'x');
    const result = await searchFiles(testRoot, 'utils', 10);
    expect(result.map((r) => r.relPath)).toContain('utils/nested/plain.ts');
    await rm(testRoot, { recursive: true, force: true });
  });

  it('strips diacritics before matching (sao matches São.ts)', async () => {
    const testRoot = await mkdtemp(join(tmpdir(), 'jide-search-'));
    await writeFile(join(testRoot, 'São.ts'), 'x');
    const result = await searchFiles(testRoot, 'sao', 10);
    expect(result.map((r) => r.relPath)).toContain('São.ts');
    await rm(testRoot, { recursive: true, force: true });
  });

  it('skips ignored directories like node_modules', async () => {
    const testRoot = await mkdtemp(join(tmpdir(), 'jide-search-'));
    await mkdir(join(testRoot, 'node_modules', 'pkg'), { recursive: true });
    await writeFile(join(testRoot, 'node_modules', 'pkg', 'target.ts'), 'x');
    await writeFile(join(testRoot, 'target.ts'), 'x');
    const result = await searchFiles(testRoot, 'target', 10);
    const paths = result.map((r) => r.relPath);
    expect(paths).toContain('target.ts');
    expect(paths).not.toContain('node_modules/pkg/target.ts');
    await rm(testRoot, { recursive: true, force: true });
  });

  it('caps results at the requested limit', async () => {
    const testRoot = await mkdtemp(join(tmpdir(), 'jide-search-'));
    for (let i = 0; i < 5; i++) {
      await writeFile(join(testRoot, `match-${i}.ts`), 'x');
    }
    const result = await searchFiles(testRoot, 'match', 3);
    expect(result).toHaveLength(3);
    await rm(testRoot, { recursive: true, force: true });
  });
});
