import { describe, it, expect } from 'vitest';
import { inferTitle, defaultTitle } from '../../../../src/main/claude/title';

describe('title inference', () => {
  it('takes the first 32 characters of a single-line prompt', () => {
    expect(inferTitle('Add a unit test for the parser')).toBe('Add a unit test for the parser');
  });

  it('truncates and adds an ellipsis past 32 chars', () => {
    expect(inferTitle('This is a much longer prompt that should be truncated nicely')).toBe(
      'This is a much longer prompt th…',
    );
    expect(inferTitle('This is a much longer prompt th…').length).toBeLessThanOrEqual(32);
  });

  it('collapses internal whitespace', () => {
    expect(inferTitle('Add   a\nlot   of   spaces')).toBe('Add a lot of spaces');
  });

  it('trims leading/trailing whitespace', () => {
    expect(inferTitle('   hello   ')).toBe('hello');
  });

  it('returns the fallback for empty/whitespace input', () => {
    expect(inferTitle('')).toBe('');
    expect(inferTitle('   ')).toBe('');
  });

  it('defaultTitle uses 1-based numbering', () => {
    expect(defaultTitle(0)).toBe('Sesión 1');
    expect(defaultTitle(3)).toBe('Sesión 4');
  });
});
