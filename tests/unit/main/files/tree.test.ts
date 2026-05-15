import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isIgnoredPath } from '../../../../src/main/files/ignore';
import { readChildren } from '../../../../src/main/files/tree';

describe('isIgnoredPath', () => {
  it('returns false for empty string (root is never ignored)', () => {
    expect(isIgnoredPath('')).toBe(false);
  });

  it('returns false for src/.gitignore (substring match prevention)', () => {
    expect(isIgnoredPath('src/.gitignore')).toBe(false);
  });

  it('returns true for src/node_modules/foo (segment match at any depth)', () => {
    expect(isIgnoredPath('src/node_modules/foo')).toBe(true);
  });

  it('returns false for .env', () => {
    expect(isIgnoredPath('.env')).toBe(false);
  });

  it('returns false for .config.json', () => {
    expect(isIgnoredPath('.config.json')).toBe(false);
  });

  it('returns true for .DS_Store', () => {
    expect(isIgnoredPath('.DS_Store')).toBe(true);
  });

  it('returns true for Thumbs.db', () => {
    expect(isIgnoredPath('Thumbs.db')).toBe(true);
  });

  it('returns true for nested .DS_Store', () => {
    expect(isIgnoredPath('src/assets/.DS_Store')).toBe(true);
  });
});

describe('readChildren', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'jide-tree-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('hides ignored segments at any depth', async () => {
    await mkdir(join(root, 'pkg', 'node_modules', 'x'), { recursive: true });
    await writeFile(join(root, 'pkg', 'main.ts'), 'x');
    const children = await readChildren(join(root, 'pkg'), root);
    expect(children.map((c) => c.name)).toEqual(['main.ts']);
  });

  it('hides all ignored directories at root', async () => {
    const ignored = [
      'node_modules',
      'dist',
      '.git',
      'out',
      '.vite',
      '.next',
      'coverage',
      '.turbo',
      'target',
      'build',
    ];
    for (const dir of ignored) {
      await mkdir(join(root, dir), { recursive: true });
    }
    await mkdir(join(root, 'src'), { recursive: true });
    const children = await readChildren(root, root);
    expect(children.map((c) => c.name)).toEqual(['src']);
  });

  it('hides .DS_Store and Thumbs.db by name', async () => {
    await writeFile(join(root, '.DS_Store'), '');
    await writeFile(join(root, 'Thumbs.db'), '');
    await writeFile(join(root, 'index.ts'), '');
    const children = await readChildren(root, root);
    expect(children.map((c) => c.name)).toEqual(['index.ts']);
  });

  it('does NOT hide .gitignore, .env, .config.json', async () => {
    await writeFile(join(root, '.gitignore'), '');
    await writeFile(join(root, '.env'), '');
    await writeFile(join(root, '.config.json'), '');
    const children = await readChildren(root, root);
    expect(children.map((c) => c.name).sort()).toEqual(
      ['.config.json', '.env', '.gitignore'].sort(),
    );
  });

  it('sorts dirs first then files, case-insensitive alpha', async () => {
    await mkdir(join(root, 'alpha'), { recursive: true });
    await mkdir(join(root, 'Beta'), { recursive: true });
    await writeFile(join(root, 'zfile.ts'), '');
    await writeFile(join(root, 'Afile.ts'), '');
    const children = await readChildren(root, root);
    expect(children.map((c) => c.name)).toEqual(['alpha', 'Beta', 'Afile.ts', 'zfile.ts']);
  });

  it('sorts files alphabetically case-insensitive', async () => {
    await writeFile(join(root, 'Banana.ts'), '');
    await writeFile(join(root, 'apple.ts'), '');
    await writeFile(join(root, 'Cherry.ts'), '');
    const children = await readChildren(root, root);
    expect(children.map((c) => c.name)).toEqual(['apple.ts', 'Banana.ts', 'Cherry.ts']);
  });

  it('populates sizeBytes for files from stat', async () => {
    await writeFile(join(root, 'hello.ts'), 'hello');
    const children = await readChildren(root, root);
    expect(children).toHaveLength(1);
    expect(children[0]?.sizeBytes).toBe(5);
  });

  it('sets sizeBytes to null for directories', async () => {
    await mkdir(join(root, 'mydir'), { recursive: true });
    const children = await readChildren(root, root);
    expect(children).toHaveLength(1);
    expect(children[0]?.kind).toBe('dir');
    expect(children[0]?.sizeBytes).toBeNull();
  });

  it('treats symlinks as file kind', async () => {
    await writeFile(join(root, 'target.ts'), 'x');
    try {
      await symlink(join(root, 'target.ts'), join(root, 'link.ts'));
    } catch {
      return;
    }
    const children = await readChildren(root, root);
    const link = children.find((c) => c.name === 'link.ts');
    expect(link?.kind).toBe('file');
  });

  it('returns empty array for empty directory', async () => {
    const empty = join(root, 'empty');
    await mkdir(empty, { recursive: true });
    const children = await readChildren(empty, root);
    expect(children).toEqual([]);
  });
});
