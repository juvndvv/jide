// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JSX, ReactNode } from 'react';
import type { SessionSnapshot } from '@shared/session';
import { KillConfirmDialog } from '../../../src/renderer/src/components/dialogs/KillConfirmDialog';
import { OverlayStackProvider } from '../../../src/renderer/src/overlay/OverlayStackContext';
import { ShortcutContextProvider } from '../../../src/renderer/src/shortcuts/ShortcutContext';
import { ThemeProvider } from '../../../src/renderer/src/theme/ThemeProvider';

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

function makeSession(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    id: { worktreeId: 'wt-1', uuid: 'abcdef123456' },
    status: 'idle',
    model: 'claude-sonnet-4',
    cwd: '/tmp/wt-1',
    title: 'Refactor billing flow',
    createdAt: 1_700_000_000_000,
    messages: [],
    rateLimit: null,
    awaitingToolUseId: null,
    totalCostUsd: 0,
    ...overrides,
  };
}

describe('KillConfirmDialog', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the title and includes the session title and model', () => {
    const session = makeSession();
    render(
      <Providers>
        <KillConfirmDialog
          worktreeId="wt-1"
          session={session}
          onCancel={vi.fn()}
          onConfirm={vi.fn().mockResolvedValue(undefined)}
        />
      </Providers>,
    );

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Matar sesión');
    const dialog = screen.getByTestId('kill-confirm-dialog');
    expect(dialog.textContent).toContain('Refactor billing flow');
    expect(dialog.textContent).toContain('claude-sonnet-4');
    expect(dialog.textContent).toContain('·');
  });

  it('falls back to "Sesión <id>" when session.title is empty', () => {
    const session = makeSession({ title: '' });
    render(
      <Providers>
        <KillConfirmDialog
          worktreeId="wt-1"
          session={session}
          onCancel={vi.fn()}
          onConfirm={vi.fn().mockResolvedValue(undefined)}
        />
      </Providers>,
    );

    const dialog = screen.getByTestId('kill-confirm-dialog');
    expect(dialog.textContent).toContain('Sesión abcdef');
  });

  it('omits the "·" separator when session.model is empty', () => {
    const session = makeSession({ model: '' });
    render(
      <Providers>
        <KillConfirmDialog
          worktreeId="wt-1"
          session={session}
          onCancel={vi.fn()}
          onConfirm={vi.fn().mockResolvedValue(undefined)}
        />
      </Providers>,
    );

    const dialog = screen.getByTestId('kill-confirm-dialog');
    expect(dialog.textContent).not.toContain('·');
  });

  it('calls onCancel when "Cancelar" is clicked and does not call onConfirm', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <Providers>
        <KillConfirmDialog
          worktreeId="wt-1"
          session={makeSession()}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      </Providers>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables both buttons and shows "Matando…" while onConfirm is pending, then restores label', async () => {
    let resolveConfirm: (() => void) | null = null;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = () => resolve();
        }),
    );
    render(
      <Providers>
        <KillConfirmDialog
          worktreeId="wt-1"
          session={makeSession()}
          onCancel={vi.fn()}
          onConfirm={onConfirm}
        />
      </Providers>,
    );

    const submit = screen.getByTestId('kill-confirm-submit');
    expect(submit.textContent).toBe('Matar');

    fireEvent.click(submit);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    const cancel = screen.getByRole('button', { name: 'Cancelar' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect((cancel as HTMLButtonElement).disabled).toBe(true);
    expect(submit.textContent).toBe('Matando…');

    await act(async () => {
      resolveConfirm?.();
      await Promise.resolve();
    });

    expect(submit.textContent).toBe('Matar');
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    expect((cancel as HTMLButtonElement).disabled).toBe(false);
  });

  it('exposes worktreeId on the panel for downstream wiring', () => {
    render(
      <Providers>
        <KillConfirmDialog
          worktreeId="wt-42"
          session={makeSession()}
          onCancel={vi.fn()}
          onConfirm={vi.fn().mockResolvedValue(undefined)}
        />
      </Providers>,
    );

    const panel = document.querySelector('[data-worktree-id="wt-42"]');
    expect(panel).not.toBeNull();
  });
});
