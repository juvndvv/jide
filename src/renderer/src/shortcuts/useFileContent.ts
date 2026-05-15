import { useEffect, useState } from 'react';
import type { FileReadResult, FileChangeEvent } from '@shared/files';

export interface UseFileContent {
  result: FileReadResult | null;
  loading: boolean;
}

export function useFileContent(worktreeId: string | null, relPath: string | null): UseFileContent {
  const [result, setResult] = useState<FileReadResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!worktreeId || !relPath) {
      setResult(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    void window.jide.files.read(worktreeId, relPath)
      .then((res) => { if (alive) setResult(res); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [worktreeId, relPath]);

  useEffect(() => {
    if (!worktreeId || !relPath) return;
    let alive = true;
    const off = window.jide.on('files:change', (event: FileChangeEvent) => {
      if (event.worktreeId !== worktreeId || event.relPath !== relPath) return;
      if (event.kind === 'unlink') {
        if (alive) setResult({ kind: 'missing' });
        return;
      }
      void window.jide.files.read(worktreeId, relPath).then((res) => {
        if (alive) setResult(res);
      });
    });
    return () => {
      alive = false;
      off();
    };
  }, [worktreeId, relPath]);

  return { result, loading };
}
