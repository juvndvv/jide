import { useEffect, useState, useCallback } from 'react';
import type { SessionSnapshot } from '@shared/session';

export interface UseSessionsList {
  sessions: SessionSnapshot[];
  activeId: string | null;
  setActive: (sessionId: string) => Promise<void>;
  create: () => Promise<SessionSnapshot | null>;
  rename: (sessionId: string, title: string) => Promise<void>;
  kill: (sessionId: string) => Promise<void>;
  capReached: boolean;
}

export function useSessionsList(worktreeId: string | null, max: number): UseSessionsList {
  const [sessions, setSessions] = useState<SessionSnapshot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!worktreeId) {
      setSessions([]);
      setActiveId(null);
      return;
    }
    let alive = true;
    void Promise.all([
      window.jide.sessions.list(worktreeId),
      window.jide.sessions.getActive(worktreeId),
    ]).then(([list, active]) => {
      if (!alive) return;
      setSessions(list);
      setActiveId(active ?? (list[0]?.id.uuid ?? null));
    });
    const off = window.jide.on('sessions:list-changed', (payload) => {
      if (payload.worktreeId !== worktreeId) return;
      setSessions(payload.sessions);
    });
    return () => {
      alive = false;
      off();
    };
  }, [worktreeId]);

  const setActive = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!worktreeId) return;
      setActiveId(sessionId);
      await window.jide.sessions.setActive(worktreeId, sessionId);
    },
    [worktreeId],
  );

  const create = useCallback(async (): Promise<SessionSnapshot | null> => {
    if (!worktreeId) return null;
    try {
      const snap = await window.jide.sessions.create(worktreeId);
      await window.jide.sessions.setActive(worktreeId, snap.id.uuid);
      setActiveId(snap.id.uuid);
      return snap;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('SESSION_CAP_REACHED')) return null;
      throw err;
    }
  }, [worktreeId]);

  const rename = useCallback(
    async (sessionId: string, title: string): Promise<void> => {
      if (!worktreeId) return;
      await window.jide.sessions.rename(worktreeId, sessionId, title);
    },
    [worktreeId],
  );

  const kill = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!worktreeId) return;
      await window.jide.sessions.kill(worktreeId, sessionId);
      if (sessionId === activeId) {
        const remaining = sessions.filter((s) => s.id.uuid !== sessionId);
        const next = remaining[0]?.id.uuid ?? null;
        setActiveId(next);
        if (next) await window.jide.sessions.setActive(worktreeId, next);
      }
    },
    [worktreeId, activeId, sessions],
  );

  const capReached = sessions.length >= max;

  return { sessions, activeId, setActive, create, rename, kill, capReached };
}
