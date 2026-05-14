import { useCallback, useEffect, useState } from 'react';
import type { SessionSnapshot } from '@shared/session';

export interface UseSession {
  snapshot: SessionSnapshot | null;
  send: (text: string) => Promise<void>;
  kill: () => Promise<void>;
  approveTool: (toolUseId: string, allow: boolean, reason?: string) => Promise<void>;
}

/**
 * Subscribes to sessions:event for the given worktreeId. Returns null
 * when worktreeId is null (no selection). Starts a session lazily on
 * the first send() call — start() is implicit inside the IPC handler.
 */
export function useSession(worktreeId: string | null): UseSession {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);

  useEffect(() => {
    if (!worktreeId) {
      setSnapshot(null);
      return;
    }
    let alive = true;
    void window.jide.sessions.get(worktreeId).then((s) => {
      if (alive) setSnapshot(s);
    });
    const off = window.jide.on('sessions:event', (payload) => {
      if (payload.worktreeId !== worktreeId) return;
      setSnapshot(payload.snapshot);
    });
    return () => {
      alive = false;
      off();
    };
  }, [worktreeId]);

  const send = useCallback(
    async (text: string): Promise<void> => {
      if (!worktreeId) return;
      await window.jide.sessions.send(worktreeId, text);
    },
    [worktreeId],
  );

  const kill = useCallback(async (): Promise<void> => {
    if (!worktreeId) return;
    await window.jide.sessions.kill(worktreeId);
  }, [worktreeId]);

  const approveTool = useCallback(
    async (toolUseId: string, allow: boolean, reason?: string): Promise<void> => {
      if (!worktreeId) return;
      await window.jide.sessions.approveTool(worktreeId, toolUseId, allow, reason);
    },
    [worktreeId],
  );

  return { snapshot, send, kill, approveTool };
}
