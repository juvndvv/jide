// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef, type JSX, type ReactNode } from 'react';
import { Overlay } from '../../../src/renderer/src/overlay/Overlay';
import {
  OverlayStackProvider,
  useIsTopOverlay,
  useModalOpen,
  useOverlayStack,
} from '../../../src/renderer/src/overlay/OverlayStackContext';
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

function StackProbe({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useOverlayStack>) => void;
}): JSX.Element {
  const stack = useOverlayStack();
  const sentRef = useRef(false);
  if (!sentRef.current) {
    sentRef.current = true;
    onReady(stack);
  }
  return <></>;
}

function ModalOpenProbe({ onChange }: { onChange: (v: boolean) => void }): JSX.Element {
  const v = useModalOpen();
  onChange(v);
  return <span data-testid="modal-open">{String(v)}</span>;
}

function TopProbe({ id }: { id: string }): JSX.Element {
  const isTop = useIsTopOverlay(id);
  return <span data-testid={`top-${id}`}>{String(isTop)}</span>;
}

describe('Overlay', () => {
  beforeEach(() => {
    // Reset focus to body to avoid cross-test bleed.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('mounts to document.body and registers a stack entry', () => {
    let modalState = false;
    render(
      <Providers>
        <ModalOpenProbe onChange={(v) => (modalState = v)} />
        <Overlay id="a" onClose={() => {}} ariaLabel="dialog-a" dataTestId="ov-a">
          <button>only</button>
        </Overlay>
      </Providers>,
    );
    const overlay = screen.getByTestId('ov-a');
    expect(overlay.parentElement).toBe(document.body);
    expect(modalState).toBe(true);
  });

  it('clicks on backdrop close; clicks on inner content do not', () => {
    const onClose = vi.fn();
    render(
      <Providers>
        <Overlay id="a" onClose={onClose} ariaLabel="dialog-a" dataTestId="ov-a">
          <div data-testid="inner">
            <button>btn</button>
          </div>
        </Overlay>
      </Providers>,
    );

    fireEvent.click(screen.getByTestId('inner'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('ov-a'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stacks by z and reports the top via getTopOnEsc', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    let stackApi: ReturnType<typeof useOverlayStack> | null = null as ReturnType<typeof useOverlayStack> | null;

    const { rerender } = render(
      <Providers>
        <StackProbe onReady={(s) => (stackApi = s)} />
        <TopProbe id="a" />
        <TopProbe id="b" />
        <Overlay id="a" z={100} onClose={closeA} ariaLabel="a">
          <button>a</button>
        </Overlay>
        <Overlay id="b" z={200} onClose={closeB} ariaLabel="b">
          <button>b</button>
        </Overlay>
      </Providers>,
    );

    expect(screen.getByTestId('top-b').textContent).toBe('true');
    expect(screen.getByTestId('top-a').textContent).toBe('false');

    act(() => {
      stackApi?.getTopOnEsc()?.();
    });
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();

    rerender(
      <Providers>
        <StackProbe onReady={(s) => (stackApi = s)} />
        <TopProbe id="a" />
        <TopProbe id="b" />
        <Overlay id="a" z={100} onClose={closeA} ariaLabel="a">
          <button>a</button>
        </Overlay>
      </Providers>,
    );

    expect(screen.getByTestId('top-a').textContent).toBe('true');
  });

  it('focus trap cycles Tab/Shift+Tab inside the overlay', () => {
    render(
      <Providers>
        <Overlay id="a" onClose={() => {}} ariaLabel="a" dataTestId="ov">
          <button data-testid="b1">one</button>
          <button data-testid="b2">two</button>
          <button data-testid="b3">three</button>
        </Overlay>
      </Providers>,
    );

    const b1 = screen.getByTestId('b1');
    const b3 = screen.getByTestId('b3');
    expect(document.activeElement).toBe(b1);

    b3.focus();
    fireEvent.keyDown(screen.getByTestId('ov'), { key: 'Tab' });
    expect(document.activeElement).toBe(b1);

    fireEvent.keyDown(screen.getByTestId('ov'), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(b3);
  });

  it('restores focus to the previously focused element on unmount', () => {
    function Host({ open }: { open: boolean }): JSX.Element {
      return (
        <Providers>
          <button data-testid="outside">outside</button>
          {open ? (
            <Overlay id="a" onClose={() => {}} ariaLabel="a">
              <button data-testid="inside">inside</button>
            </Overlay>
          ) : null}
        </Providers>
      );
    }

    const { rerender } = render(<Host open={false} />);
    const outside = screen.getByTestId('outside');
    outside.focus();
    expect(document.activeElement).toBe(outside);

    rerender(<Host open={true} />);
    expect(document.activeElement).toBe(screen.getByTestId('inside'));

    rerender(<Host open={false} />);
    expect(document.activeElement).toBe(screen.getByTestId('outside'));
  });

  it('respects closeOnBackdrop={false}', () => {
    const onClose = vi.fn();
    render(
      <Providers>
        <Overlay
          id="a"
          onClose={onClose}
          ariaLabel="a"
          dataTestId="ov"
          closeOnBackdrop={false}
        >
          <button>x</button>
        </Overlay>
      </Providers>,
    );
    fireEvent.click(screen.getByTestId('ov'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('warns and ignores duplicate ids', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let stackApi: ReturnType<typeof useOverlayStack> | null = null as ReturnType<typeof useOverlayStack> | null;
    render(
      <Providers>
        <StackProbe onReady={(s) => (stackApi = s)} />
        <Overlay id="dup" onClose={() => {}} ariaLabel="dup">
          <button>x</button>
        </Overlay>
      </Providers>,
    );

    act(() => {
      stackApi?.push({ id: 'dup', z: 100, onEsc: () => {} });
    });

    expect(warn).toHaveBeenCalled();
    expect(stackApi?.size()).toBe(1);
  });
});
