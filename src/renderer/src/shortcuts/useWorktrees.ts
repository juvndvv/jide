import { useEffect, useState, useCallback } from 'react';
import type { Worktree } from '@shared/project';

export interface UseWorktrees {
  worktrees: Worktree[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useWorktrees(projectId: string | null): UseWorktrees {
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setWorktrees([]);
      setLoading(false);
      return;
    }
    const next = await window.jide.worktrees.list(projectId);
    setWorktrees(next);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    refresh().catch((err: unknown) => {
      console.error('[jide] worktrees:list failed', err);
      setLoading(false);
    });
    if (!projectId) return;
    const offStatus = window.jide.on('worktrees:status-changed', (payload) => {
      if (payload.projectId !== projectId) return;
      setWorktrees((prev) =>
        prev.map((w) => (w.path === payload.worktree.path ? payload.worktree : w)),
      );
    });
    const offChanged = window.jide.on('worktrees:changed', (payload) => {
      if (payload.projectId !== projectId) return;
      setWorktrees(payload.worktrees);
    });
    return () => {
      offStatus();
      offChanged();
    };
  }, [projectId, refresh]);

  return { worktrees, loading, refresh };
}
