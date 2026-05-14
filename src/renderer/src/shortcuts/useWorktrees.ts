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
    void refresh();
    if (!projectId) return;
    const off = window.jide.on('worktrees:status-changed', (payload) => {
      if (payload.projectId !== projectId) return;
      setWorktrees((prev) =>
        prev.map((w) => (w.path === payload.worktree.path ? payload.worktree : w)),
      );
    });
    return off;
  }, [projectId, refresh]);

  return { worktrees, loading, refresh };
}
