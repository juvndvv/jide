import { useCallback, useEffect, useRef } from 'react';

export interface UseTerminal {
  onData: (cb: (chunk: string) => void) => () => void;
  write: (data: string) => Promise<void>;
  resize: (cols: number, rows: number) => Promise<void>;
  ensureCreated: (cwd: string, cols: number, rows: number) => Promise<void>;
  kill: () => Promise<void>;
}

export function useTerminal(worktreeId: string | null): UseTerminal {
  const createdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      createdRef.current = null;
    };
  }, [worktreeId]);

  const onData = useCallback(
    (cb: (chunk: string) => void) => {
      return window.jide.on('terminal:data', (payload) => {
        if (worktreeId && payload.worktreeId === worktreeId) cb(payload.data);
      });
    },
    [worktreeId],
  );

  const ensureCreated = useCallback(
    async (cwd: string, cols: number, rows: number): Promise<void> => {
      if (!worktreeId) return;
      if (createdRef.current === worktreeId) return;
      await window.jide.terminal.create(worktreeId, cwd, cols, rows);
      createdRef.current = worktreeId;
    },
    [worktreeId],
  );

  const write = useCallback(
    async (data: string): Promise<void> => {
      if (!worktreeId) return;
      await window.jide.terminal.write(worktreeId, data);
    },
    [worktreeId],
  );

  const resize = useCallback(
    async (cols: number, rows: number): Promise<void> => {
      if (!worktreeId) return;
      await window.jide.terminal.resize(worktreeId, cols, rows);
    },
    [worktreeId],
  );

  const kill = useCallback(async (): Promise<void> => {
    if (!worktreeId) return;
    await window.jide.terminal.kill(worktreeId);
    createdRef.current = null;
  }, [worktreeId]);

  return { onData, write, resize, ensureCreated, kill };
}
