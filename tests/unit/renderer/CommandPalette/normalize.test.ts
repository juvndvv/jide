import { describe, expect, it } from 'vitest';
import { normalize } from '../../../../src/renderer/src/components/CommandPalette/normalize';

describe('normalize', () => {
  it('strips diacritics from a single accented word', () => {
    expect(normalize('Cámara')).toBe('camara');
  });

  it('handles compound phrases with mixed accents', () => {
    expect(normalize('São Paulo')).toBe('sao paulo');
  });

  it('handles tildes and uppercase', () => {
    expect(normalize('Ñoño')).toBe('nono');
  });

  it('returns empty string for empty input', () => {
    expect(normalize('')).toBe('');
  });
});
