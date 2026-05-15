// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JSX, ReactNode } from 'react';
import type { Project, Worktree } from '@shared/project';
import { CommandPalette } from '../../../../src/renderer/src/components/CommandPalette/CommandPalette';
import { OverlayStackProvider } from '../../../../src/renderer/src/overlay/OverlayStackContext';
import {
  ShortcutContextProvider,
  ShortcutDispatcherContext,
  type ShortcutDispatcher,
  type ShortcutId,
} from '../../../../src/renderer/src/shortcuts/ShortcutContext';
import { ThemeProvider } from '../../../../src/renderer/src/theme/ThemeProvider';

function makeDispatcher(): { dispatcher: ShortcutDispatcher; dispatch: ReturnType<typeof vi.fn> } {
  const dispatch = vi.fn<(id: ShortcutId) => void>();
  const dispatcher: ShortcutDispatcher = {
    register: () => () => {},
    dispatch: (id) => dispatch(id),
  };
  return { dispatcher, dispatch };
}

function Providers({
  children,
  dispatcher,
}: {
  children: ReactNode;
  dispatcher: ShortcutDispatcher;
}): JSX.Element {
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
        <ShortcutDispatcherContext.Provider value={dispatcher}>
          <OverlayStackProvider>{children}</OverlayStackProvider>
        </ShortcutDispatcherContext.Provider>
      </ShortcutContextProvider>
    </ThemeProvider>
  );
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p-1',
    name: 'jide',
    path: '/repos/jide',
    expanded: true,
    ...overrides,
  };
}

function makeWorktree(overrides: Partial<Worktree> = {}): Worktree {
  return {
    id: '/repos/jide:wt-main',
    branch: 'main',
    path: '/repos/jide-wt-main',
    head: 'abc123',
    status: 'clean',
    claude: 'idle',
    changes: 0,
    ahead: 0,
    behind: 0,
    ...overrides,
  };
}

function getInput(): HTMLInputElement {
  const input = screen.getByPlaceholderText(/Buscar acciones/i);
  return input as HTMLInputElement;
}

function visibleItemTexts(): string[] {
  const items = document.querySelectorAll<HTMLElement>('[cmdk-item]');
  return Array.from(items).map((el) => el.textContent ?? '');
}

function visibleGroupHeadings(): string[] {
  const headings = document.querySelectorAll<HTMLElement>('[cmdk-group-heading]');
  return Array.from(headings)
    .filter((h) => {
      const group = h.closest<HTMLElement>('[cmdk-group]');
      if (!group) return false;
      return group.getAttribute('hidden') === null;
    })
    .map((h) => h.textContent ?? '');
}

describe('CommandPalette', () => {
  beforeEach(() => {
    // Polyfill scrollIntoView used internally by cmdk.
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    // Polyfill ResizeObserver — cmdk subscribes to size changes on the list.
    class ResizeObserverPolyfill {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as unknown as { ResizeObserver: typeof ResizeObserverPolyfill }).ResizeObserver =
      ResizeObserverPolyfill;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders both "Acciones" and "Worktrees" groups when both have items', () => {
    const { dispatcher } = makeDispatcher();
    const project = makeProject();
    const worktreesById = new Map([[makeWorktree().id, makeWorktree()]]);

    render(
      <Providers dispatcher={dispatcher}>
        <CommandPalette
          open
          onClose={vi.fn()}
          projects={[project]}
          worktreesById={worktreesById}
          onOpenWorktree={vi.fn()}
          activeWorktreeId={null}
          onOpenFile={vi.fn()}
        />
      </Providers>,
    );

    const headings = visibleGroupHeadings();
    expect(headings).toContain('Acciones');
    expect(headings).toContain('Worktrees');
  });

  it('renders Kbd shortcut labels next to action items', () => {
    const { dispatcher } = makeDispatcher();
    render(
      <Providers dispatcher={dispatcher}>
        <CommandPalette
          open
          onClose={vi.fn()}
          projects={[]}
          worktreesById={new Map()}
          onOpenWorktree={vi.fn()}
          activeWorktreeId={null}
          onOpenFile={vi.fn()}
        />
      </Providers>,
    );

    const palette = screen.getByTestId('command-palette');
    expect(palette.textContent).toContain('meta+n');
    expect(palette.textContent).toContain('meta+,');
  });

  it('filters items by query (action label substring)', () => {
    const { dispatcher } = makeDispatcher();
    render(
      <Providers dispatcher={dispatcher}>
        <CommandPalette
          open
          onClose={vi.fn()}
          projects={[]}
          worktreesById={new Map()}
          onOpenWorktree={vi.fn()}
          activeWorktreeId={null}
          onOpenFile={vi.fn()}
        />
      </Providers>,
    );

    act(() => {
      fireEvent.change(getInput(), { target: { value: 'tweaks' } });
    });

    const items = visibleItemTexts();
    expect(items.some((t) => t.toLowerCase().includes('tweaks'))).toBe(true);
    expect(items.some((t) => t.toLowerCase().includes('ciclar terminal'))).toBe(false);
  });

  it('filters worktrees accent-insensitively (sao matches São Paulo branch)', () => {
    const { dispatcher } = makeDispatcher();
    const project = makeProject({ id: 'p-br', name: 'brazil', path: '/repos/br' });
    const wt = makeWorktree({
      id: '/repos/br:wt-sp',
      branch: 'São Paulo',
      path: '/repos/br-sp',
    });
    const worktreesById = new Map([[wt.id, wt]]);

    render(
      <Providers dispatcher={dispatcher}>
        <CommandPalette
          open
          onClose={vi.fn()}
          projects={[project]}
          worktreesById={worktreesById}
          onOpenWorktree={vi.fn()}
          activeWorktreeId={null}
          onOpenFile={vi.fn()}
        />
      </Providers>,
    );

    act(() => {
      fireEvent.change(getInput(), { target: { value: 'sao' } });
    });

    const items = visibleItemTexts();
    expect(items.some((t) => t.includes('São Paulo'))).toBe(true);
  });

  it('dispatches the action id when an action item is selected', () => {
    const { dispatcher, dispatch } = makeDispatcher();
    const onClose = vi.fn();
    render(
      <Providers dispatcher={dispatcher}>
        <CommandPalette
          open
          onClose={onClose}
          projects={[]}
          worktreesById={new Map()}
          onOpenWorktree={vi.fn()}
          activeWorktreeId={null}
          onOpenFile={vi.fn()}
        />
      </Providers>,
    );

    act(() => {
      fireEvent.change(getInput(), { target: { value: 'tweaks' } });
    });

    // cmdk auto-selects the first matching item; Enter on the input dispatches it.
    act(() => {
      fireEvent.keyDown(getInput(), { key: 'Enter' });
    });

    expect(dispatch).toHaveBeenCalledWith('tweaks.toggle');
    expect(onClose).toHaveBeenCalled();
  });

  it('opens a worktree tab and closes on worktree selection', () => {
    const { dispatcher } = makeDispatcher();
    const onClose = vi.fn();
    const onOpenWorktree = vi.fn<(wid: string, pid: string) => void>();
    const project = makeProject({ id: 'p-1', path: '/repos/jide' });
    const wt = makeWorktree({ id: '/repos/jide:wt-zeta', branch: 'zeta-branch' });
    const worktreesById = new Map([[wt.id, wt]]);

    render(
      <Providers dispatcher={dispatcher}>
        <CommandPalette
          open
          onClose={onClose}
          projects={[project]}
          worktreesById={worktreesById}
          onOpenWorktree={onOpenWorktree}
          activeWorktreeId={null}
          onOpenFile={vi.fn()}
        />
      </Providers>,
    );

    act(() => {
      fireEvent.change(getInput(), { target: { value: 'zeta' } });
    });

    act(() => {
      fireEvent.keyDown(getInput(), { key: 'Enter' });
    });

    expect(onOpenWorktree).toHaveBeenCalledWith(wt.id, project.id);
    expect(onClose).toHaveBeenCalled();
  });

  it('returns null when open is false', () => {
    const { dispatcher } = makeDispatcher();
    render(
      <Providers dispatcher={dispatcher}>
        <CommandPalette
          open={false}
          onClose={vi.fn()}
          projects={[]}
          worktreesById={new Map()}
          onOpenWorktree={vi.fn()}
          activeWorktreeId={null}
          onOpenFile={vi.fn()}
        />
      </Providers>,
    );

    expect(screen.queryByTestId('command-palette')).toBeNull();
  });
});
