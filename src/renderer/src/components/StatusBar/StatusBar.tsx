import type { JSX } from 'react';
import type { Project, Worktree } from '@shared/project';
import { StatusItem } from './StatusItem';
import { useTheme } from '../../theme/useTheme';

export interface StatusBarProps {
  project: Project | null;
  worktree: Worktree | null;
}

function describeClaude(state: Worktree['claude']): string {
  switch (state) {
    case 'running':
      return 'claude · ejecutando';
    case 'awaiting':
      return 'claude · esperando';
    case 'error':
      return 'claude · error';
    case 'idle':
    default:
      return 'claude · en reposo';
  }
}

export function StatusBar({ project, worktree }: StatusBarProps): JSX.Element {
  const { accent } = useTheme();
  if (!worktree || !project) {
    return (
      <footer
        data-testid="status-bar"
        style={{
          height: 26,
          flexShrink: 0,
          background: accent.value,
          color: '#FFFFFF',
        }}
      />
    );
  }
  return (
    <footer
      data-testid="status-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        height: 26,
        padding: '0 4px 0 0',
        flexShrink: 0,
        background: accent.value,
        color: '#FFFFFF',
        fontFamily: 'Geist, ui-monospace, monospace',
        fontSize: 11.5,
      }}
    >
      <StatusItem icon="branch">{worktree.branch}</StatusItem>
      <StatusItem icon="arrow-up">{worktree.ahead}</StatusItem>
      <StatusItem icon="arrow-down">{worktree.behind}</StatusItem>
      <StatusItem icon="diff">{worktree.changes} cambios</StatusItem>
      <div style={{ flex: 1 }} />
      <StatusItem icon="claude">{describeClaude(worktree.claude)}</StatusItem>
      <StatusItem icon="cli">$ {project.path}</StatusItem>
    </footer>
  );
}
