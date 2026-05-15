import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  FileNode,
  FileChangeEvent,
  FileStatusChangeEvent,
  GitFileStatus,
} from '@shared/files';

export interface FlatTreeRow {
  node: FileNode;
  /** Depth from root (root = 0). Used for indent. */
  depth: number;
  isExpanded: boolean;
  status: GitFileStatus;
}

export interface UseFileTree {
  rows: FlatTreeRow[];
  loadingRoot: boolean;
  toggleExpand: (relPath: string) => void;
  refresh: () => void;
}

export function useFileTree(worktreeId: string | null): UseFileTree {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set<string>(['']));
  const [children, setChildren] = useState<Map<string, FileNode[]>>(() => new Map());
  const [status, setStatus] = useState<Map<string, GitFileStatus>>(() => new Map());
  const [loadingRoot, setLoadingRoot] = useState(false);

  const fetchChildren = useCallback(async (relPath: string | null): Promise<void> => {
    if (!worktreeId) return;
    const key = relPath ?? '';
    if (key === '') setLoadingRoot(true);
    const perfLabel = `[perf] useFileTree fetchChildren (${worktreeId} :: ${key === '' ? '<root>' : key})`;
    console.time(perfLabel);
    try {
      const nodes = await window.jide.files.tree(worktreeId, relPath);
      console.timeEnd(perfLabel);
      console.log(`[perf] useFileTree fetchChildren returned ${nodes.length} nodes for ${key === '' ? '<root>' : key}`);
      setChildren((prev) => {
        const next = new Map(prev);
        next.set(key, nodes);
        return next;
      });
    } finally {
      if (key === '') setLoadingRoot(false);
    }
  }, [worktreeId]);

  useEffect(() => {
    setExpanded(new Set<string>(['']));
    setChildren(new Map());
    setStatus(new Map());
    void fetchChildren(null);
  }, [worktreeId, fetchChildren]);

  useEffect(() => {
    if (!worktreeId) return;
    const off = window.jide.on('files:change', (event: FileChangeEvent) => {
      if (event.worktreeId !== worktreeId) return;
      const slash = event.relPath.lastIndexOf('/');
      const parent = slash === -1 ? '' : event.relPath.slice(0, slash);
      void fetchChildren(parent === '' ? null : parent);
    });
    return off;
  }, [worktreeId, fetchChildren]);

  useEffect(() => {
    if (!worktreeId) return;
    const off = window.jide.on('files:status-changed', (e: FileStatusChangeEvent) => {
      if (e.worktreeId !== worktreeId) return;
      setStatus((prev) => {
        const next = new Map(prev);
        for (const [p, s] of Object.entries(e.changes)) {
          if (s === null) next.delete(p);
          else next.set(p, s);
        }
        return next;
      });
    });
    return off;
  }, [worktreeId]);

  const toggleExpand = useCallback((relPath: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) {
        next.delete(relPath);
      } else {
        next.add(relPath);
        if (!children.has(relPath)) void fetchChildren(relPath);
      }
      return next;
    });
  }, [children, fetchChildren]);

  const rows = useMemo<FlatTreeRow[]>(() => {
    const out: FlatTreeRow[] = [];
    const walk = (parent: string, depth: number): void => {
      const list = children.get(parent) ?? [];
      for (const node of list) {
        const isExpanded = expanded.has(node.relPath);
        out.push({ node, depth, isExpanded, status: status.get(node.relPath) ?? null });
        if (node.kind === 'dir' && isExpanded) walk(node.relPath, depth + 1);
      }
    };
    walk('', 0);
    return out;
  }, [children, expanded, status]);

  const refresh = useCallback(() => { void fetchChildren(null); }, [fetchChildren]);

  return {
    rows,
    loadingRoot,
    toggleExpand,
    refresh,
  };
}
