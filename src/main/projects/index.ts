import { existsSync, statSync, realpathSync } from 'node:fs';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Project } from '@shared/project';
import type { JideStore } from '../store/index.js';

export interface ProjectRegistry {
  list(): Project[];
  add(path: string): Promise<Project>;
  remove(id: string): void;
}

export function createProjectRegistry(store: JideStore): ProjectRegistry {
  return {
    list() {
      return store.get('projects');
    },
    async add(inputPath) {
      if (!existsSync(inputPath)) {
        throw new Error(`Path does not exist: ${inputPath}`);
      }
      const stat = statSync(inputPath);
      if (!stat.isDirectory()) {
        throw new Error(`Path is not a directory: ${inputPath}`);
      }
      const canonical = realpathSync(inputPath);
      if (!existsSync(join(canonical, '.git'))) {
        throw new Error(`Path is not a git repository: ${canonical}`);
      }
      const existing = store.get('projects');
      if (existing.some((p) => p.path === canonical)) {
        throw new Error(`Project already added: ${canonical}`);
      }
      const project: Project = {
        id: randomUUID(),
        name: basename(canonical),
        path: canonical,
        expanded: true,
      };
      store.set('projects', [...existing, project]);
      return Promise.resolve(project);
    },
    remove(id) {
      const existing = store.get('projects');
      store.set(
        'projects',
        existing.filter((p) => p.id !== id),
      );
    },
  };
}
