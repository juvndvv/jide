import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  assignSession,
  countLeaves,
  flattenLeafIds,
  makeEmptyLayout,
  MAX_CHAT_PANES,
  mergeLeaf,
  pruneOrphans,
  setRatio,
  splitLeaf,
  toggleAxis,
} from '@shared/layout.js';
import type { PaneAxis, PaneTree, TerminalSplit, WorktreeLayout } from '@shared/layout.js';

const PERSIST_DEBOUNCE_MS = 200;

export interface WorktreeLayoutOps {
  splitActivePane: (axis: PaneAxis) => void;
  mergePane: (leafId: string) => void;
  assignToPane: (leafId: string, sessionId: string | null) => void;
  /** Like assignToPane but allows the same session in multiple panes (used for drag-and-drop). */
  dropToPane: (leafId: string, sessionId: string) => void;
  setActivePane: (leafId: string) => void;
  toggleSplitAxis: (splitId: string) => void;
  setSplitRatio: (splitId: string, ratio: number) => void;
  cycleTerminal: () => void;
  setTerminal: (state: TerminalSplit) => void;
  toggleTerminalOrientation: () => void;
  closeTerminal: () => void;
  setTerminalRatio: (ratio: number) => void;
}

export interface UseWorktreeLayout {
  /** Always non-null after hydration. While hydrating, returns the empty default. */
  layout: WorktreeLayout;
  ops: WorktreeLayoutOps;
  cap: { reached: boolean; count: number; max: number };
}

export function useWorktreeLayout(worktreeId: string | null): UseWorktreeLayout {
  const [layout, setLayout] = useState<WorktreeLayout>(makeEmptyLayout);
  const hydratedFor = useRef<string | null>(null);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function schedulePersist(currentWorktreeId: string | null, next: WorktreeLayout): void {
    if (!currentWorktreeId) return;
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      void (async () => {
        const existing = await window.jide.settings.get('layoutByWt');
        await window.jide.settings.set('layoutByWt', { ...existing, [currentWorktreeId]: next });
      })().catch((err: unknown) => console.error('[jide] persist layout failed', err));
    }, PERSIST_DEBOUNCE_MS);
  }

  useEffect(() => {
    if (worktreeId === null) {
      setLayout(makeEmptyLayout());
      hydratedFor.current = null;
      return;
    }

    if (hydratedFor.current === worktreeId) return;

    let alive = true;

    void (async () => {
      const [layoutByWt, snapshots] = await Promise.all([
        window.jide.settings.get('layoutByWt'),
        window.jide.sessions.list(worktreeId),
      ]);

      if (!alive) return;

      const stored = layoutByWt[worktreeId] ?? makeEmptyLayout();
      const validUuids = new Set(snapshots.map((s) => s.id.uuid));
      const prunedPanes: PaneTree = pruneOrphans(stored.panes, validUuids);

      const leafIds = flattenLeafIds(prunedPanes);
      const activePaneId = leafIds.includes(stored.activePaneId)
        ? stored.activePaneId
        : (leafIds[0] ?? stored.activePaneId);

      setLayout({ ...stored, panes: prunedPanes, activePaneId });
      hydratedFor.current = worktreeId;
    })().catch((err: unknown) => {
      console.error('[jide] useWorktreeLayout hydration failed', err);
    });

    return () => {
      alive = false;
    };
  }, [worktreeId]);

  // On unmount, cancel any pending persist. We intentionally do not flush because
  // a 200 ms window at unmount is an acceptable trade-off — flushing synchronously
  // during cleanup would require a non-cancellable side-effect or a sync IPC call.
  useEffect(() => {
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, []);

  const splitActivePane = useCallback(
    (axis: PaneAxis) => {
      setLayout((prev) => {
        if (countLeaves(prev.panes) >= MAX_CHAT_PANES) return prev;
        const nextPanes = splitLeaf(prev.panes, prev.activePaneId, axis);
        if (nextPanes === prev.panes) return prev;
        const next: WorktreeLayout = { ...prev, panes: nextPanes };
        schedulePersist(worktreeId, next);
        return next;
      });
    },
    [worktreeId],
  );

  const mergePane = useCallback(
    (leafId: string) => {
      setLayout((prev) => {
        const nextPanes = mergeLeaf(prev.panes, leafId);
        if (nextPanes === prev.panes) return prev;
        const leafIds = flattenLeafIds(nextPanes);
        const activePaneId = leafIds.includes(prev.activePaneId)
          ? prev.activePaneId
          : (leafIds[0] ?? prev.activePaneId);
        const next: WorktreeLayout = { ...prev, panes: nextPanes, activePaneId };
        schedulePersist(worktreeId, next);
        return next;
      });
    },
    [worktreeId],
  );

  const assignToPane = useCallback(
    (leafId: string, sessionId: string | null) => {
      setLayout((prev) => {
        const nextPanes = assignSession(prev.panes, leafId, sessionId);
        if (nextPanes === prev.panes) return prev;
        const next: WorktreeLayout = { ...prev, panes: nextPanes };
        schedulePersist(worktreeId, next);
        return next;
      });
    },
    [worktreeId],
  );

  const dropToPane = useCallback(
    (leafId: string, sessionId: string) => {
      setLayout((prev) => {
        // Non-exclusive: allows the same session in multiple panes.
        const nextPanes = assignSession(prev.panes, leafId, sessionId, false);
        if (nextPanes === prev.panes) return prev;
        const next: WorktreeLayout = { ...prev, panes: nextPanes };
        schedulePersist(worktreeId, next);
        return next;
      });
    },
    [worktreeId],
  );

  const setActivePane = useCallback(
    (leafId: string) => {
      setLayout((prev) => {
        if (prev.activePaneId === leafId) return prev;
        const next: WorktreeLayout = { ...prev, activePaneId: leafId };
        schedulePersist(worktreeId, next);
        return next;
      });
    },
    [worktreeId],
  );

  const toggleSplitAxis = useCallback(
    (splitId: string) => {
      setLayout((prev) => {
        const nextPanes = toggleAxis(prev.panes, splitId);
        if (nextPanes === prev.panes) return prev;
        const next: WorktreeLayout = { ...prev, panes: nextPanes };
        schedulePersist(worktreeId, next);
        return next;
      });
    },
    [worktreeId],
  );

  const setSplitRatio = useCallback(
    (splitId: string, ratio: number) => {
      setLayout((prev) => {
        const nextPanes = setRatio(prev.panes, splitId, ratio);
        if (nextPanes === prev.panes) return prev;
        const next: WorktreeLayout = { ...prev, panes: nextPanes };
        schedulePersist(worktreeId, next);
        return next;
      });
    },
    [worktreeId],
  );

  const cycleTerminal = useCallback(() => {
    setLayout((prev) => {
      const cycle: Record<TerminalSplit, TerminalSplit> = {
        off: 'bottom',
        bottom: 'side',
        side: 'off',
      };
      const next: WorktreeLayout = { ...prev, terminal: cycle[prev.terminal] };
      schedulePersist(worktreeId, next);
      return next;
    });
  }, [worktreeId]);

  const setTerminal = useCallback(
    (state: TerminalSplit) => {
      setLayout((prev) => {
        if (prev.terminal === state) return prev;
        const next: WorktreeLayout = { ...prev, terminal: state };
        schedulePersist(worktreeId, next);
        return next;
      });
    },
    [worktreeId],
  );

  const toggleTerminalOrientation = useCallback(() => {
    setLayout((prev) => {
      const next: WorktreeLayout = {
        ...prev,
        terminal: prev.terminal === 'bottom' ? 'side' : 'bottom',
      };
      schedulePersist(worktreeId, next);
      return next;
    });
  }, [worktreeId]);

  const closeTerminal = useCallback(() => {
    setLayout((prev) => {
      if (prev.terminal === 'off') return prev;
      const next: WorktreeLayout = { ...prev, terminal: 'off' };
      schedulePersist(worktreeId, next);
      return next;
    });
  }, [worktreeId]);

  const setTerminalRatio = useCallback(
    (ratio: number) => {
      setLayout((prev) => {
        const clamped = Math.min(0.9, Math.max(0.1, ratio));
        if (prev.terminalRatio === clamped) return prev;
        const next: WorktreeLayout = { ...prev, terminalRatio: clamped };
        schedulePersist(worktreeId, next);
        return next;
      });
    },
    [worktreeId],
  );

  const ops = useMemo<WorktreeLayoutOps>(
    () => ({
      splitActivePane,
      mergePane,
      assignToPane,
      dropToPane,
      setActivePane,
      toggleSplitAxis,
      setSplitRatio,
      cycleTerminal,
      setTerminal,
      toggleTerminalOrientation,
      closeTerminal,
      setTerminalRatio,
    }),
    [
      splitActivePane,
      mergePane,
      assignToPane,
      dropToPane,
      setActivePane,
      toggleSplitAxis,
      setSplitRatio,
      cycleTerminal,
      setTerminal,
      toggleTerminalOrientation,
      closeTerminal,
      setTerminalRatio,
    ],
  );

  const count = countLeaves(layout.panes);
  const cap = useMemo(
    () => ({ reached: count >= MAX_CHAT_PANES, count, max: MAX_CHAT_PANES }),
    [count],
  );

  return { layout, ops, cap };
}
