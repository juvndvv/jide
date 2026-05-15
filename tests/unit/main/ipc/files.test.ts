import { sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveWithinRoot } from '../../../../src/main/ipc/files';

const root = sep === '/' ? '/project/repo' : 'C:\\project\\repo';

describe('resolveWithinRoot', () => {
  it('returns null for a relative path that escapes with ../', () => {
    expect(resolveWithinRoot(root, '../etc')).toBeNull();
  });

  it('returns null for a deeply nested escape: src/../../etc', () => {
    expect(resolveWithinRoot(root, 'src/../../etc')).toBeNull();
  });

  it('returns null for an absolute path outside the root', () => {
    const outside = sep === '/' ? '/etc/passwd' : 'C:\\Windows\\system32\\drivers\\etc\\hosts';
    expect(resolveWithinRoot(root, outside)).toBeNull();
  });

  it('returns null when the resolved path equals the root itself', () => {
    expect(resolveWithinRoot(root, '.')).toBeNull();
  });

  it('accepts a relative path inside the root and returns the correct abs + rel', () => {
    const result = resolveWithinRoot(root, 'src/index.ts');
    expect(result).not.toBeNull();
    expect(result!.rel).toBe('src/index.ts');
  });

  it('accepts an absolute path inside the root', () => {
    const inside = sep === '/' ? '/project/repo/src/foo.ts' : 'C:\\project\\repo\\src\\foo.ts';
    const result = resolveWithinRoot(root, inside);
    expect(result).not.toBeNull();
    expect(result!.rel).toBe('src/foo.ts');
  });

  it('returns a POSIX relPath even on Windows (uses forward slashes)', () => {
    const result = resolveWithinRoot(root, 'a/b/c.ts');
    expect(result).not.toBeNull();
    expect(result!.rel).not.toContain('\\');
    expect(result!.rel).toBe('a/b/c.ts');
  });

  it('returns null for a bare .. input', () => {
    expect(resolveWithinRoot(root, '..')).toBeNull();
  });
});
