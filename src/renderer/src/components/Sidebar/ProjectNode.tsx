import type { Project, Worktree } from '@shared/project';
import { JIcon } from '../icons/JIcon';
import { WorktreeRow } from './WorktreeRow';
import { useTheme } from '../../theme/useTheme';

export function ProjectNode({
  project,
  worktrees,
  activeWorktreeId,
  onToggle,
  onSelectWorktree,
}: {
  project: Project;
  worktrees: Worktree[];
  activeWorktreeId: string | null;
  onToggle: () => void;
  onSelectWorktree: (id: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <div>
      <button
        type="button"
        data-testid={`project-${project.name}`}
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          height: 28,
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          borderRadius: 6,
          textAlign: 'left',
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 600,
          color: 'inherit',
        }}
      >
        <JIcon
          name={project.expanded ? 'chev-d' : 'chev-r'}
          size={11}
          style={{ color: theme.textMed }}
        />
        <JIcon
          name={project.expanded ? 'folder-open' : 'folder'}
          size={14}
          style={{ color: theme.textMed }}
        />
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {project.name}
        </span>
        <span
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11,
            color: theme.textMed,
            fontWeight: 500,
          }}
        >
          {worktrees.length}
        </span>
      </button>
      {project.expanded && (
        <div>
          {worktrees.map((w) => (
            <WorktreeRow
              key={w.path}
              worktree={w}
              active={w.id === activeWorktreeId}
              onClick={() => onSelectWorktree(w.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
