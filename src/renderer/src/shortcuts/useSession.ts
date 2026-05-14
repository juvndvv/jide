import { useCallback, useEffect, useState } from 'react';
import type { SessionSnapshot } from '@shared/session';

export interface UseSession {
  snapshot: SessionSnapshot | null;
  send: (text: string) => Promise<void>;
  kill: () => Promise<void>;
  approveTool: (toolUseId: string, allow: boolean, reason?: string) => Promise<void>;
}

export function useSession(worktreeId: string | null, sessionId: string | null): UseSession {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);

  useEffect(() => {
    if (!worktreeId || !sessionId) {
      setSnapshot(null);
      return;
    }
    let alive = true;
    window.jide.sessions
      .get(worktreeId, sessionId)
      .then((s) => {
        if (alive) setSnapshot(s);
      })
      .catch((err: unknown) => {
        console.error('[jide] sessions:get failed', err);
      });
    const off = window.jide.on('sessions:event', (payload) => {
      if (payload.worktreeId !== worktreeId) return;
      if (payload.snapshot.id.uuid !== sessionId) return;
      setSnapshot(payload.snapshot);
    });
    return () => {
      alive = false;
      off();
    };
  }, [worktreeId, sessionId]);

  const send = useCallback(
    async (text: string): Promise<void> => {
      if (!worktreeId || !sessionId) return;
      await window.jide.sessions.send(worktreeId, sessionId, text);
    },
    [worktreeId, sessionId],
  );

  const kill = useCallback(async (): Promise<void> => {
    if (!worktreeId || !sessionId) return;
    await window.jide.sessions.kill(worktreeId, sessionId);
  }, [worktreeId, sessionId]);

  const approveTool = useCallback(
    async (toolUseId: string, allow: boolean, reason?: string): Promise<void> => {
      if (!worktreeId || !sessionId) return;
      await window.jide.sessions.approveTool(worktreeId, sessionId, toolUseId, allow, reason);
    },
    [worktreeId, sessionId],
  );

  return { snapshot, send, kill, approveTool };
}
