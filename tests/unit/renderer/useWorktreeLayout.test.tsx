// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorktreeLayout } from '@renderer/shortcuts/useWorktreeLayout';
import { flattenLeafIds, makeEmptyLayout, MAX_CHAT_PANES } from '@shared/layout';
import type { WorktreeLayout } from '@shared/layout';

function setupJideMock(options?: {
  storedLayout?: Record<string, WorktreeLayout>;
  sessions?: { id: { uuid: string } }[];
}) {
  const settingsStore = new Map<string, unknown>();
  settingsStore.set('layoutByWt', options?.storedLayout ?? {});
  const get = vi.fn((k: string) => Promise.resolve(settingsStore.get(k)));
  const set = vi.fn((k: string, v: unknown) => {
    settingsStore.set(k, v);
    return Promise.resolve();
  });
  const list = vi.fn(() => Promise.resolve(options?.sessions ?? []));
  (window as unknown as Record<string, unknown>).jide = {
    settings: { get, set },
    sessions: { list },
    on: vi.fn(() => () => {}),
  };
  return { get, set, list, settingsStore };
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useWorktreeLayout', () => {
  describe('initial state', () => {
    it('has one empty leaf, terminal off, activePaneId equals leaf id', async () => {
      const { get, list } = setupJideMock();
      const { result } = renderHook(() => useWorktreeLayout('wt-1'));

      // Before hydration resolves, returns the empty default
      expect(result.current.layout.terminal).toBe('off');
      expect(result.current.layout.panes.kind).toBe('leaf');

      await waitFor(() => expect(get).toHaveBeenCalled());
      await waitFor(() => expect(list).toHaveBeenCalled());

      const { layout } = result.current;
      expect(layout.panes.kind).toBe('leaf');
      expect(layout.terminal).toBe('off');
      expect(flattenLeafIds(layout.panes)).toContain(layout.activePaneId);
    });
  });

  describe('splitActivePane', () => {
    it('produces a tree with 2 leaves after splitting vertically', async () => {
      const { get, list } = setupJideMock();
      const { result } = renderHook(() => useWorktreeLayout('wt-1'));

      await waitFor(() => expect(get).toHaveBeenCalled());
      await waitFor(() => expect(list).toHaveBeenCalled());

      act(() => {
        result.current.ops.splitActivePane('v');
      });

      expect(flattenLeafIds(result.current.layout.panes)).toHaveLength(2);
    });

    it('is a no-op when at cap (4 leaves)', async () => {
      const { get, list } = setupJideMock();
      const { result } = renderHook(() => useWorktreeLayout('wt-1'));

      await waitFor(() => expect(get).toHaveBeenCalled());
      await waitFor(() => expect(list).toHaveBeenCalled());

      act(() => { result.current.ops.splitActivePane('v'); });
      act(() => { result.current.ops.splitActivePane('h'); });
      act(() => { result.current.ops.splitActivePane('v'); });

      expect(flattenLeafIds(result.current.layout.panes)).toHaveLength(MAX_CHAT_PANES);

      act(() => { result.current.ops.splitActivePane('v'); });

      expect(flattenLeafIds(result.current.layout.panes)).toHaveLength(MAX_CHAT_PANES);
    });
  });

  describe('cycleTerminal', () => {
    it('cycles off → bottom → side → off', async () => {
      const { get, list } = setupJideMock();
      const { result } = renderHook(() => useWorktreeLayout('wt-1'));

      await waitFor(() => expect(get).toHaveBeenCalled());
      await waitFor(() => expect(list).toHaveBeenCalled());

      expect(result.current.layout.terminal).toBe('off');

      act(() => { result.current.ops.cycleTerminal(); });
      expect(result.current.layout.terminal).toBe('bottom');

      act(() => { result.current.ops.cycleTerminal(); });
      expect(result.current.layout.terminal).toBe('side');

      act(() => { result.current.ops.cycleTerminal(); });
      expect(result.current.layout.terminal).toBe('off');
    });
  });

  describe('toggleTerminalOrientation', () => {
    it('flips bottom ↔ side', async () => {
      const { get, list } = setupJideMock();
      const { result } = renderHook(() => useWorktreeLayout('wt-1'));

      await waitFor(() => expect(get).toHaveBeenCalled());
      await waitFor(() => expect(list).toHaveBeenCalled());

      act(() => { result.current.ops.setTerminal('bottom'); });
      expect(result.current.layout.terminal).toBe('bottom');

      act(() => { result.current.ops.toggleTerminalOrientation(); });
      expect(result.current.layout.terminal).toBe('side');

      act(() => { result.current.ops.toggleTerminalOrientation(); });
      expect(result.current.layout.terminal).toBe('bottom');
    });

    it('goes to bottom when terminal is off', async () => {
      const { get, list } = setupJideMock();
      const { result } = renderHook(() => useWorktreeLayout('wt-1'));

      await waitFor(() => expect(get).toHaveBeenCalled());
      await waitFor(() => expect(list).toHaveBeenCalled());

      expect(result.current.layout.terminal).toBe('off');

      act(() => { result.current.ops.toggleTerminalOrientation(); });
      expect(result.current.layout.terminal).toBe('bottom');
    });
  });

  describe('closeTerminal', () => {
    it('sets terminal to off', async () => {
      const { get, list } = setupJideMock();
      const { result } = renderHook(() => useWorktreeLayout('wt-1'));

      await waitFor(() => expect(get).toHaveBeenCalled());
      await waitFor(() => expect(list).toHaveBeenCalled());

      act(() => { result.current.ops.setTerminal('side'); });
      expect(result.current.layout.terminal).toBe('side');

      act(() => { result.current.ops.closeTerminal(); });
      expect(result.current.layout.terminal).toBe('off');
    });
  });

  describe('assignToPane', () => {
    it('assigning the same session to leafB clears it from leafA', async () => {
      const { get, list } = setupJideMock();
      const { result } = renderHook(() => useWorktreeLayout('wt-1'));

      await waitFor(() => expect(get).toHaveBeenCalled());
      await waitFor(() => expect(list).toHaveBeenCalled());

      act(() => { result.current.ops.splitActivePane('v'); });

      const leafIds = flattenLeafIds(result.current.layout.panes);
      const [leafA, leafB] = leafIds as [string, string];

      act(() => { result.current.ops.assignToPane(leafA, 'uuid-1'); });
      {
        const panes = result.current.layout.panes;
        const findLeafSession = (id: string): string | null => {
          const ids = flattenLeafIds(panes);
          if (!ids.includes(id)) return null;
          function walk(tree: WorktreeLayout['panes']): string | null {
            if (tree.kind === 'leaf') return tree.id === id ? tree.sessionId : null;
            return walk(tree.first) ?? walk(tree.second);
          }
          return walk(panes);
        };
        expect(findLeafSession(leafA)).toBe('uuid-1');
      }

      act(() => { result.current.ops.assignToPane(leafB, 'uuid-1'); });
      {
        const panes = result.current.layout.panes;
        function getSession(tree: typeof panes, id: string): string | null {
          if (tree.kind === 'leaf') return tree.id === id ? tree.sessionId : null;
          return getSession(tree.first, id) ?? getSession(tree.second, id);
        }
        expect(getSession(panes, leafA)).toBeNull();
        expect(getSession(panes, leafB)).toBe('uuid-1');
      }
    });
  });

  describe('hydration', () => {
    it('loads stored layout and prunes orphan session refs on worktreeId change', async () => {
      const emptyLayout = makeEmptyLayout();
      const leafId = flattenLeafIds(emptyLayout.panes)[0]!;
      const storedLayout: WorktreeLayout = {
        ...emptyLayout,
        panes: { kind: 'leaf', id: leafId, sessionId: 'orphan-uuid' },
      };

      const { get, list } = setupJideMock({
        storedLayout: { 'wt-1': storedLayout },
        sessions: [],
      });

      const { result } = renderHook(() => useWorktreeLayout('wt-1'));

      await waitFor(() => expect(get).toHaveBeenCalled());
      await waitFor(() => expect(list).toHaveBeenCalled());

      const panes = result.current.layout.panes;
      expect(panes.kind).toBe('leaf');
      if (panes.kind === 'leaf') {
        expect(panes.sessionId).toBeNull();
      }
    });

    it('resets to empty layout when worktreeId changes to null', async () => {
      const { get, list } = setupJideMock();
      let worktreeId: string | null = 'wt-1';
      const { result, rerender } = renderHook(() => useWorktreeLayout(worktreeId));

      await waitFor(() => expect(get).toHaveBeenCalled());
      await waitFor(() => expect(list).toHaveBeenCalled());

      act(() => { result.current.ops.splitActivePane('v'); });
      expect(flattenLeafIds(result.current.layout.panes)).toHaveLength(2);

      worktreeId = null;
      rerender();

      expect(flattenLeafIds(result.current.layout.panes)).toHaveLength(1);
      expect(result.current.layout.terminal).toBe('off');
    });
  });

  describe('persist debounce', () => {
    it('calls settings.set with the latest state value after multiple rapid ops', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: false });

      const { set, get, list } = setupJideMock();

      // Render the hook and wait for hydration with real async resolution
      const { result } = renderHook(() => useWorktreeLayout('wt-1'));

      // Flush pending promises so the async hydration effect kicks off
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(get).toHaveBeenCalled();
      expect(list).toHaveBeenCalled();

      // Record set calls before the ops (hydration doesn't persist)
      const callsBefore = set.mock.calls.filter(([k]) => k === 'layoutByWt').length;

      // Fire 3 ops in a single act so React batches them and the debounce timer isn't advanced
      act(() => {
        result.current.ops.cycleTerminal(); // off → bottom
        result.current.ops.cycleTerminal(); // bottom → side
        result.current.ops.cycleTerminal(); // side → off
      });

      // 3 cycles: off → bottom → side → off
      expect(result.current.layout.terminal).toBe('off');

      // No write yet — debounce hasn't fired
      expect(set.mock.calls.filter(([k]) => k === 'layoutByWt').length).toBe(callsBefore);

      // Advance timers past the debounce window and flush promises
      await act(async () => {
        vi.advanceTimersByTime(250);
        await Promise.resolve();
        await Promise.resolve();
      });

      const layoutSetCalls = set.mock.calls.filter(([k]) => k === 'layoutByWt');

      // Should have at most 1 write for the 3 batched ops
      expect(layoutSetCalls.length - callsBefore).toBe(1);

      // The write reflects the final state (3 cycles = back to 'off')
      const lastCall = layoutSetCalls[layoutSetCalls.length - 1];
      expect(lastCall).toBeDefined();
      const writtenRecord = lastCall![1] as Record<string, WorktreeLayout>;
      expect(writtenRecord['wt-1']?.terminal).toBe('off');

      vi.useRealTimers();
    });
  });

  describe('cap', () => {
    it('cap.reached flips to true once 4 leaves exist', async () => {
      const { get, list } = setupJideMock();
      const { result } = renderHook(() => useWorktreeLayout('wt-1'));

      await waitFor(() => expect(get).toHaveBeenCalled());
      await waitFor(() => expect(list).toHaveBeenCalled());

      expect(result.current.cap.reached).toBe(false);
      expect(result.current.cap.count).toBe(1);
      expect(result.current.cap.max).toBe(MAX_CHAT_PANES);

      act(() => { result.current.ops.splitActivePane('v'); });
      expect(result.current.cap.reached).toBe(false);
      expect(result.current.cap.count).toBe(2);

      act(() => { result.current.ops.splitActivePane('h'); });
      expect(result.current.cap.reached).toBe(false);
      expect(result.current.cap.count).toBe(3);

      act(() => { result.current.ops.splitActivePane('v'); });
      expect(result.current.cap.reached).toBe(true);
      expect(result.current.cap.count).toBe(MAX_CHAT_PANES);
    });
  });
});
