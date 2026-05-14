// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { type JSX } from 'react';
import { useTheme } from '@renderer/theme/useTheme';
import { ThemeProvider } from '@renderer/theme/ThemeProvider';

function Probe(): JSX.Element {
  const t = useTheme();
  return (
    <div
      data-testid="probe"
      data-mode={t.effectiveMode}
      data-accent={t.accent.id}
      data-density-row={t.density.row}
      data-side={t.sidebarSide}
      style={{ background: t.theme.appBg }}
    />
  );
}

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_e: string, fn: () => void) => {
      listeners.add(fn);
    },
    removeEventListener: (_e: string, fn: () => void) => {
      listeners.delete(fn);
    },
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  } as unknown as MediaQueryList);
  return { listeners };
}

function setup(initialMode: 'light' | 'dark' | 'auto' = 'light', mqDark = false) {
  const persist = {
    setMode: vi.fn(),
    setAccent: vi.fn(),
    setDensity: vi.fn(),
    setSidebarSide: vi.fn(),
  };
  mockMatchMedia(mqDark);
  const utils = render(
    <ThemeProvider
      initial={{ mode: initialMode, accent: 'coral', density: 'comfy', sidebarSide: 'left' }}
      persist={persist}
    >
      <Probe />
    </ThemeProvider>,
  );
  return { ...utils, persist };
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('--jide-accent');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('resolves explicit light mode', () => {
    const { getByTestId } = setup('light');
    expect(getByTestId('probe').dataset.mode).toBe('light');
  });

  it('resolves explicit dark mode', () => {
    const { getByTestId } = setup('dark');
    expect(getByTestId('probe').dataset.mode).toBe('dark');
  });

  it('resolves auto via prefers-color-scheme', () => {
    const { getByTestId } = setup('auto', true);
    expect(getByTestId('probe').dataset.mode).toBe('dark');
  });

  it('syncs --jide-accent on :root', () => {
    setup('light');
    expect(document.documentElement.style.getPropertyValue('--jide-accent')).toBe('#F95A5C');
  });

  it('throws if useTheme is used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/within <ThemeProvider>/);
    spy.mockRestore();
  });
});
