// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JSX, ReactNode } from 'react';
import { HelpDialog } from '../../../src/renderer/src/components/dialogs/HelpDialog';
import { OverlayStackProvider } from '../../../src/renderer/src/overlay/OverlayStackContext';
import { ShortcutContextProvider } from '../../../src/renderer/src/shortcuts/ShortcutContext';
import { ThemeProvider } from '../../../src/renderer/src/theme/ThemeProvider';
import { keymap } from '../../../src/renderer/src/shortcuts/keymap';

function Providers({ children }: { children: ReactNode }): JSX.Element {
  const persist = {
    setMode: vi.fn(),
    setAccent: vi.fn(),
    setDensity: vi.fn(),
    setSidebarSide: vi.fn(),
  };
  return (
    <ThemeProvider
      initial={{ mode: 'light', accent: 'coral', density: 'comfy', sidebarSide: 'left' }}
      persist={persist}
    >
      <ShortcutContextProvider>
        <OverlayStackProvider>{children}</OverlayStackProvider>
      </ShortcutContextProvider>
    </ThemeProvider>
  );
}

describe('HelpDialog', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders all keymap entries with helpGroup grouped by their helpGroup', () => {
    render(
      <Providers>
        <HelpDialog onClose={vi.fn()} />
      </Providers>,
    );

    const expectedHeadings = new Set<string>();
    for (const b of keymap) {
      if (b.helpGroup !== undefined) expectedHeadings.add(b.helpGroup);
    }

    for (const heading of expectedHeadings) {
      const nodes = screen.getAllByRole('heading', { level: 3, name: heading });
      expect(nodes.length).toBe(1);
    }

    const dialog = screen.getByTestId('help-dialog');
    for (const b of keymap) {
      if (b.helpGroup === undefined) continue;
      const label = b.paletteLabel ?? b.id;
      expect(dialog.textContent).toContain(label);
    }
  });

  it('shows the keys via <Kbd> and the paletteLabel as the description', () => {
    render(
      <Providers>
        <HelpDialog onClose={vi.fn()} />
      </Providers>,
    );

    const dialog = screen.getByTestId('help-dialog');
    const rows = dialog.querySelectorAll('tbody tr');
    const paletteBinding = Array.from(rows).find((row) =>
      row.textContent?.includes('Abrir command palette'),
    );
    expect(paletteBinding).toBeDefined();
    expect(paletteBinding?.textContent).toContain('meta+k');
    expect(paletteBinding?.textContent).toContain('Abrir command palette');
  });

  it('omits entries without helpGroup', () => {
    render(
      <Providers>
        <HelpDialog onClose={vi.fn()} />
      </Providers>,
    );

    const dialog = screen.getByTestId('help-dialog');
    const rows = dialog.querySelectorAll('tbody tr');
    const withHelpGroup = keymap.filter((b) => b.helpGroup !== undefined);
    expect(rows.length).toBe(withHelpGroup.length);
    expect(rows.length).toBeLessThanOrEqual(keymap.length);
  });
});
