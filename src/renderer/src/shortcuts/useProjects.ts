import { useEffect, useState, useCallback } from 'react';
import type { Project } from '@shared/project';

export interface UseProjects {
  projects: Project[];
  loading: boolean;
  add: () => Promise<Project | null>;
  remove: (id: string) => Promise<void>;
  toggleExpanded: (id: string) => void;
}

export function useProjects(): UseProjects {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    window.jide.projects
      .list()
      .then((list) => {
        if (alive) {
          setProjects(list);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        console.error('[jide] projects:list failed', err);
        if (alive) setLoading(false);
      });
    const off = window.jide.on('projects:changed', (next) => setProjects(next));
    return () => {
      alive = false;
      off();
    };
  }, []);

  const add = useCallback(() => window.jide.projects.add(), []);
  const remove = useCallback((id: string) => window.jide.projects.remove(id), []);
  const toggleExpanded = useCallback((id: string) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, expanded: !p.expanded } : p)));
  }, []);

  return { projects, loading, add, remove, toggleExpanded };
}
