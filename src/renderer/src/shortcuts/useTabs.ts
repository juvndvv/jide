import { useEffect, useRef, useState } from 'react';
import type { Project, Worktree } from '@shared/project';
import type { TabRef } from '@shared/settings';

export interface UseTabsResult {
  tabs: TabRef[];
  activeWorktreeId: string | null;
  open: (worktreeId: string, projectId: string) => void;
  close: (worktreeId: string) => void;
  setActive: (worktreeId: string) => void;
}

export function useTabs(args: {
  projects: Project[];
  worktreesById: ReadonlyMap<string, Worktree>;
}): UseTabsResult {
  const { projects, worktreesById } = args;

  const [tabs, setTabs] = useState<TabRef[]>([]);
  const [activeWorktreeId, setActiveWorktreeId] = useState<string | null>(null);

  const hydrated = useRef(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = (nextTabs: TabRef[], nextActive: string | null): void => {
    if (persistTimer.current !== null) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      window.jide.settings.set('openTabs', nextTabs).catch((err: unknown) => {
        console.error('[jide] settings:set openTabs failed', err);
      });
      window.jide.settings.set('lastWorktreeId', nextActive).catch((err: unknown) => {
        console.error('[jide] settings:set lastWorktreeId failed', err);
      });
    }, 200);
  };

  // Hydrate once when data is ready.
  useEffect(() => {
    if (hydrated.current) return;

    const ready = worktreesById.size > 0 || projects.length === 0;
    if (!ready) return;

    hydrated.current = true;

    const hydrate = async (): Promise<void> => {
      const [stored, last] = await Promise.all([
        window.jide.settings.get('openTabs'),
        window.jide.settings.get('lastWorktreeId'),
      ]);

      const filtered = stored.filter((t) => worktreesById.has(t.worktreeId));
      const resolvedActive =
        last && worktreesById.has(last) ? last : (filtered[0]?.worktreeId ?? null);

      setTabs(filtered);
      setActiveWorktreeId(resolvedActive);
    };

    hydrate().catch((err: unknown) => {
      console.error('[jide] useTabs hydration failed', err);
    });
  });

  // Filter orphaned tabs whenever worktreesById changes post-hydration.
  useEffect(() => {
    if (!hydrated.current) return;
    if (worktreesById.size === 0) return;

    setTabs((prev) => {
      const filtered = prev.filter((t) => worktreesById.has(t.worktreeId));
      if (filtered.length === prev.length) return prev;

      setActiveWorktreeId((active) => {
        const nextActive =
          active && worktreesById.has(active) ? active : (filtered[0]?.worktreeId ?? null);
        persist(filtered, nextActive);
        return nextActive;
      });

      return filtered;
    });
  }, [worktreesById]);

  const open = (worktreeId: string, projectId: string): void => {
    setTabs((prev) => {
      const already = prev.some((t) => t.worktreeId === worktreeId);
      const next = already ? prev : [...prev, { worktreeId, projectId }];
      setActiveWorktreeId(worktreeId);
      persist(next, worktreeId);
      return next;
    });
  };

  const close = (worktreeId: string): void => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.worktreeId !== worktreeId);
      setActiveWorktreeId((active) => {
        let nextActive = active;
        if (active === worktreeId) {
          nextActive = next[next.length - 1]?.worktreeId ?? null;
        }
        persist(next, nextActive);
        return nextActive;
      });
      return next;
    });
  };

  const setActive = (worktreeId: string): void => {
    setActiveWorktreeId(worktreeId);
    setTabs((prev) => {
      persist(prev, worktreeId);
      return prev;
    });
  };

  return { tabs, activeWorktreeId, open, close, setActive };
}
