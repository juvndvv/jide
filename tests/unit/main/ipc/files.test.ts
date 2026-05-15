import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveWithinRoot } from '../../../../src/main/ipc/files';

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
