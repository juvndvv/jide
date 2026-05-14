import { useEffect, useRef, useState } from 'react';
import type { Project, Worktree } from '@shared/project';

export function useAllWorktrees(projects: Project[]): {
  worktreesById: ReadonlyMap<string, Worktree>;
  loading: boolean;
} {
  const [worktreesById, setWorktreesById] = useState<Map<string, Worktree>>(new Map());
  const [loading, setLoading] = useState(true);

  // Track which worktree ids belong to each project so we can evict stale entries.
  const byProject = useRef<Map<string, Set<string>>>(new Map());

  const projectIdsKey = projects.map((p) => p.id).join('|');

  useEffect(() => {
    if (projects.length === 0) {
      setWorktreesById(new Map());
      setLoading(false);
      return;
    }

    let alive = true;

    const fetchAll = async (): Promise<void> => {
      const results = await Promise.all(
        projects.map(async (p) => {
          const list = await window.jide.worktrees.list(p.id);
          return { projectId: p.id, list };
        }),
      );

      if (!alive) return;

      const next = new Map<string, Worktree>();
      const nextByProject = new Map<string, Set<string>>();

      for (const { projectId, list } of results) {
        const ids = new Set<string>();
        for (const wt of list) {
          next.set(wt.id, wt);
          ids.add(wt.id);
        }
        nextByProject.set(projectId, ids);
      }

      byProject.current = nextByProject;
      setWorktreesById(new Map(next));
      setLoading(false);
    };

    fetchAll().catch((err: unknown) => {
      console.error('[jide] useAllWorktrees:fetchAll failed', err);
      if (alive) setLoading(false);
    });

    const offStatus = window.jide.on('worktrees:status-changed', (payload) => {
      const wt = payload.worktree;
      setWorktreesById((prev) => {
        const next = new Map(prev);
        next.set(wt.id, wt);
        return next;
      });

      // Keep provenance tracking up to date.
      const ids = byProject.current.get(payload.projectId) ?? new Set<string>();
      ids.add(wt.id);
      byProject.current.set(payload.projectId, ids);
    });

    const offChanged = window.jide.on('worktrees:changed', (payload) => {
      const { projectId, worktrees } = payload;
      const newIds = new Set(worktrees.map((w) => w.id));

      setWorktreesById((prev) => {
        const next = new Map(prev);

        // Remove entries that belonged to this project but are no longer present.
        const oldIds = byProject.current.get(projectId) ?? new Set<string>();
        for (const oldId of oldIds) {
          if (!newIds.has(oldId)) next.delete(oldId);
        }

        // Upsert new entries.
        for (const wt of worktrees) {
          next.set(wt.id, wt);
        }

        return next;
      });

      byProject.current.set(projectId, newIds);
    });

    return () => {
      alive = false;
      offStatus();
      offChanged();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIdsKey]);

  return { worktreesById, loading };
}
