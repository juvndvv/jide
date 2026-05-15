import { Command } from 'cmdk';
import type { JSX } from 'react';
import type { Project, Worktree } from '@shared/project';

interface Props {
  projects: Project[];
  worktreesById: ReadonlyMap<string, Worktree>;
  onOpen: (worktreeId: string, projectId: string) => void;
  onSelect: () => void;
}

interface Entry {
  wt: Worktree;
  project: Project;
}

function findProjectForWorktree(wt: Worktree, projects: Project[]): Project | null {
  const matched = projects.find((p) => wt.id.startsWith(`${p.path}:`));
  return matched ?? null;
}

export function PaletteWorktreesGroup({
  projects,
  worktreesById,
  onOpen,
  onSelect,
}: Props): JSX.Element | null {
  const entries: Entry[] = [];
  for (const wt of worktreesById.values()) {
    const project = findProjectForWorktree(wt, projects);
    if (project === null) continue;
    entries.push({ wt, project });
  }

  if (entries.length === 0) return null;

  return (
    <Command.Group heading="Worktrees">
      {entries.map(({ wt, project }) => (
        <Command.Item
          key={wt.id}
          value={`${project.name} / ${wt.branch}`}
          keywords={[wt.path, wt.id, project.name, wt.branch]}
          onSelect={() => {
            onOpen(wt.id, project.id);
            onSelect();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 10px',
            borderRadius: 6,
            cursor: 'pointer',
            gap: 6,
          }}
        >
          <span>{project.name}</span>
          <span style={{ marginLeft: 6, opacity: 0.7 }}>/ {wt.branch}</span>
        </Command.Item>
      ))}
    </Command.Group>
  );
}
