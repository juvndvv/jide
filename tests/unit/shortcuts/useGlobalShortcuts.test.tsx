// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, act } from '@testing-library/react';
import { type JSX, type ReactNode } from 'react';
import type {
  ShortcutContext,
  ShortcutDispatcher,
  ShortcutId,
} from '@renderer/shortcuts/ShortcutContext';

function stubMacPlatform(): () => void {
  const originalPlatform = Object.getOwnPropertyDescriptor(window.navigator, 'platform');
  const originalUa = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
  Object.defineProperty(window.navigator, 'platform', { value: 'MacIntel', configurable: true });
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
    configurable: true,
  });
  return () => {
    if (originalPlatform) Object.defineProperty(window.navigator, 'platform', originalPlatform);
    if (originalUa) Object.defineProperty(window.navigator, 'userAgent', originalUa);
  };
}

interface Harness {
  ctx: ShortcutContext;
  dispatch: Mock<(id: ShortcutId) => void>;
}

function makeHarness(overrides?: Partial<ShortcutContext>): Harness {
  return {
    ctx: {
      modalOpen: false,
      inputFocused: false,
      chatFocused: false,
      sessionActive: false,
      sessionCapReached: false,
      ...overrides,
    },
    dispatch: vi.fn<(id: ShortcutId) => void>(),
  };
}

async function renderEngine(harness: Harness): Promise<{ unmount: () => void }> {
  const ctxMod = await import('@renderer/shortcuts/ShortcutContext');
  const { useGlobalShortcuts } = await import('@renderer/shortcuts/useGlobalShortcuts');
  const dispatcher: ShortcutDispatcher = {
    register: () => () => {},
    dispatch: harness.dispatch,
  };

  function Engine(): JSX.Element {
    useGlobalShortcuts();
    return <div />;
  }

  function Wrapper({ children }: { children: ReactNode }): JSX.Element {
    return (
      <ctxMod.ShortcutContextStateContext.Provider value={harness.ctx}>
        <ctxMod.ShortcutDispatcherContext.Provider value={dispatcher}>
          {children}
        </ctxMod.ShortcutDispatcherContext.Provider>
      </ctxMod.ShortcutContextStateContext.Provider>
    );
  }

  const result = render(
    <Wrapper>
      <Engine />
    </Wrapper>,
  );
  return { unmount: result.unmount };
}

function fire(key: string, init: KeyboardEventInit = {}): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ...init }));
  });
}

describe('useGlobalShortcuts', () => {
  let restorePlatform: () => void = () => {};

  beforeEach(() => {
    restorePlatform = stubMacPlatform();
    vi.resetModules();
  });

  afterEach(() => {
    restorePlatform();
    vi.restoreAllMocks();
  });

  it('dispatches palette.open on meta+k when modalOpen=false', async () => {
    const harness = makeHarness({ modalOpen: false });
    const { unmount } = await renderEngine(harness);
    fire('k', { metaKey: true });
    expect(harness.dispatch).toHaveBeenCalledWith('palette.open');
    unmount();
  });

  it('dispatches palette.open on meta+k even when modalOpen=true (ALWAYS)', async () => {
    const harness = makeHarness({ modalOpen: true });
    const { unmount } = await renderEngine(harness);
    fire('k', { metaKey: true });
    expect(harness.dispatch).toHaveBeenCalledWith('palette.open');
    unmount();
  });

  it('does NOT dispatch worktree.new when modalOpen=true (NOT_MODAL)', async () => {
    const harness = makeHarness({ modalOpen: true });
    const { unmount } = await renderEngine(harness);
    fire('n', { metaKey: true });
    expect(harness.dispatch).not.toHaveBeenCalledWith('worktree.new');
    unmount();
  });

  it('does NOT dispatch overlay.close on escape when modalOpen=false (ONLY_MODAL)', async () => {
    const harness = makeHarness({ modalOpen: false });
    const { unmount } = await renderEngine(harness);
    fire('Escape');
    expect(harness.dispatch).not.toHaveBeenCalledWith('overlay.close');
    unmount();
  });

  it('dispatches overlay.close on escape when modalOpen=true', async () => {
    const harness = makeHarness({ modalOpen: true });
    const { unmount } = await renderEngine(harness);
    fire('Escape');
    expect(harness.dispatch).toHaveBeenCalledWith('overlay.close');
    unmount();
  });

  it('does NOT dispatch help.open on "?" when inputFocused=true', async () => {
    const harness = makeHarness({ inputFocused: true });
    const { unmount } = await renderEngine(harness);
    fire('?', { shiftKey: true });
    expect(harness.dispatch).not.toHaveBeenCalledWith('help.open');
    unmount();
  });

  it('dispatches help.open on "?" when modalOpen=false and inputFocused=false', async () => {
    const harness = makeHarness();
    const { unmount } = await renderEngine(harness);
    fire('?', { shiftKey: true });
    expect(harness.dispatch).toHaveBeenCalledWith('help.open');
    unmount();
  });
});
