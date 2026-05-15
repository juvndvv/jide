// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseKeys, matchKey } from '@renderer/shortcuts/matchKeys';

function stubPlatform(platform: string, userAgent: string): () => void {
  const original = Object.getOwnPropertyDescriptor(window.navigator, 'platform');
  const originalUa = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
  Object.defineProperty(window.navigator, 'platform', { value: platform, configurable: true });
  Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
  return () => {
    if (original) Object.defineProperty(window.navigator, 'platform', original);
    if (originalUa) Object.defineProperty(window.navigator, 'userAgent', originalUa);
  };
}

describe('parseKeys', () => {
  it('parses meta+shift+k into mods + lowercase key', () => {
    expect(parseKeys('meta+shift+k')).toEqual({
      mods: { meta: true, shift: true, alt: false, ctrl: false },
      key: 'k',
    });
  });

  it('parses a bare key with no modifiers', () => {
    expect(parseKeys('?')).toEqual({
      mods: { meta: false, shift: false, alt: false, ctrl: false },
      key: '?',
    });
  });

  it('parses ctrl+x explicitly', () => {
    expect(parseKeys('ctrl+x')).toEqual({
      mods: { meta: false, shift: false, alt: false, ctrl: true },
      key: 'x',
    });
  });

  it('normalizes case and whitespace', () => {
    expect(parseKeys(' Meta + K ')).toEqual({
      mods: { meta: true, shift: false, alt: false, ctrl: false },
      key: 'k',
    });
  });
});

describe('matchKey', () => {
  let restorePlatform: () => void = () => {};

  beforeEach(() => {
    restorePlatform = () => {};
  });

  afterEach(() => {
    restorePlatform();
    vi.restoreAllMocks();
  });

  it('matches meta+k on macOS via metaKey=true', () => {
    restorePlatform = stubPlatform('MacIntel', 'Mozilla/5.0 (Macintosh; Intel Mac OS X)');
    const parsed = parseKeys('meta+k');
    const e = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
    expect(matchKey(parsed, e)).toBe(true);
  });

  it('matches meta+k on Windows via ctrlKey=true', () => {
    restorePlatform = stubPlatform('Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    const parsed = parseKeys('meta+k');
    const e = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
    expect(matchKey(parsed, e)).toBe(true);
  });

  it('does not match meta+k on macOS when only ctrlKey is set', () => {
    restorePlatform = stubPlatform('MacIntel', 'Mozilla/5.0 (Macintosh; Intel Mac OS X)');
    const parsed = parseKeys('meta+k');
    const e = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
    expect(matchKey(parsed, e)).toBe(false);
  });

  it("matches '?' when shiftKey is true (matcher inspects e.key directly)", () => {
    const parsed = parseKeys('?');
    const e = new KeyboardEvent('keydown', { key: '?', shiftKey: true });
    expect(matchKey(parsed, e)).toBe(true);
  });

  it('rejects extra modifier: meta+k must not match metaKey+shiftKey event', () => {
    restorePlatform = stubPlatform('MacIntel', 'Mozilla/5.0 (Macintosh; Intel Mac OS X)');
    const parsed = parseKeys('meta+k');
    const e = new KeyboardEvent('keydown', { key: 'k', metaKey: true, shiftKey: true });
    expect(matchKey(parsed, e)).toBe(false);
  });

  it('matches escape with no modifiers', () => {
    const parsed = parseKeys('escape');
    const e = new KeyboardEvent('keydown', { key: 'Escape' });
    expect(matchKey(parsed, e)).toBe(true);
  });

  it('matches meta+shift+k on macOS', () => {
    restorePlatform = stubPlatform('MacIntel', 'Mozilla/5.0 (Macintosh; Intel Mac OS X)');
    const parsed = parseKeys('meta+shift+k');
    const e = new KeyboardEvent('keydown', { key: 'K', metaKey: true, shiftKey: true });
    expect(matchKey(parsed, e)).toBe(true);
  });
});
