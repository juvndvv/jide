import { describe, expect, it } from 'vitest';
import { parsePorcelain } from '../../../../src/main/files/git-status';

describe('parsePorcelain', () => {
  it('parses a simple modified file (worktree column)', () => {
    const result = parsePorcelain(' M src/foo.ts\0');
    expect(result.size).toBe(1);
    expect(result.get('src/foo.ts')).toBe('M');
  });

  it('parses multiple untracked files', () => {
    const result = parsePorcelain('?? new.ts\0?? other/x.ts\0');
    expect(result.size).toBe(2);
    expect(result.get('new.ts')).toBe('??');
    expect(result.get('other/x.ts')).toBe('??');
  });

  it('parses a renamed file and skips the old path', () => {
    const result = parsePorcelain('R  new.ts\0old.ts\0 M after.ts\0');
    expect(result.get('new.ts')).toBe('R');
    expect(result.get('after.ts')).toBe('M');
    expect(result.has('old.ts')).toBe(false);
  });

  it('returns M when both index and worktree columns are M', () => {
    const result = parsePorcelain('MM src/foo.ts\0');
    expect(result.get('src/foo.ts')).toBe('M');
  });

  it('parses paths with spaces', () => {
    const result = parsePorcelain(' M src/has space.ts\0');
    expect(result.get('src/has space.ts')).toBe('M');
  });

  it('returns empty map for empty input', () => {
    const result = parsePorcelain('');
    expect(result.size).toBe(0);
  });

  it('parses a copied file and skips the original path', () => {
    const result = parsePorcelain('C  copy.ts\0src/orig.ts\0');
    expect(result.get('copy.ts')).toBe('C');
    expect(result.has('src/orig.ts')).toBe(false);
  });

  it('parses a deleted file (worktree column)', () => {
    const result = parsePorcelain(' D removed.ts\0');
    expect(result.get('removed.ts')).toBe('D');
  });

  it('parses a staged added file', () => {
    const result = parsePorcelain('A  new.ts\0');
    expect(result.get('new.ts')).toBe('A');
  });

  it('parses an unmerged file', () => {
    const result = parsePorcelain('UU conflict.ts\0');
    expect(result.get('conflict.ts')).toBe('U');
  });

  it('handles malformed input without a NUL terminator without throwing', () => {
    expect(() => parsePorcelain(' M unterminated')).not.toThrow();
    const result = parsePorcelain(' M unterminated');
    expect(result instanceof Map).toBe(true);
  });

  it('parses a mixed sequence correctly', () => {
    const result = parsePorcelain('?? a.ts\0 M b.ts\0R  c.ts\0d.ts\0');
    expect(result.get('a.ts')).toBe('??');
    expect(result.get('b.ts')).toBe('M');
    expect(result.get('c.ts')).toBe('R');
    expect(result.has('d.ts')).toBe(false);
  });

  it('M beats A regardless of which column holds it (MA input yields M)', () => {
    const result = parsePorcelain('MA src/foo.ts\0');
    expect(result.get('src/foo.ts')).toBe('M');
  });
});
