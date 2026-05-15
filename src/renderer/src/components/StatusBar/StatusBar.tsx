import type { JSX } from 'react';
import type { Project, Worktree } from '@shared/project';
import { StatusItem } from './StatusItem';
import { JIcon } from '../icons/JIcon';
import { useTheme } from '../../theme/useTheme';

export interface StatusBarProps {
  project: Project | null;
  worktree: Worktree | null;
  terminalSplit?: 'off' | 'bottom' | 'side';
  onToggleTerminal?: () => void;
  viewerOpen?: boolean;
  onToggleViewer?: () => void;
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

export function StatusBar({
  project,
  worktree,
  terminalSplit = 'off',
  onToggleTerminal,
  viewerOpen = false,
  onToggleViewer,
}: StatusBarProps): JSX.Element {
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
      {/* Viewer + Term buttons — rgba(255,255,255,0.18) is intentional: white highlight on accent band (same exception as #FFFFFF text on accent, established in Fase 5) */}
      <button
        type="button"
        data-testid="status-viewer-button"
        aria-label="Visor (⌘O)"
        onClick={onToggleViewer}
        style={{
          height: 22,
          padding: '0 9px',
          marginRight: 2,
          borderRadius: 4,
          border: 0,
          background: viewerOpen ? 'rgba(255,255,255,0.18)' : 'transparent',
          color: '#FFFFFF',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 11.5,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <JIcon name={viewerOpen ? 'folder-open' : 'folder'} size={11} />
        <span>Visor</span>
        <span style={{ opacity: 0.7 }}>⌘O</span>
      </button>
      <button
        type="button"
        data-testid="status-term-button"
        aria-label="Terminal (⌘\\)"
        onClick={onToggleTerminal}
        style={{
          height: 22,
          padding: '0 9px',
          marginRight: 2,
          borderRadius: 4,
          border: 0,
          background: terminalSplit !== 'off' ? 'rgba(255,255,255,0.18)' : 'transparent',
          color: '#FFFFFF',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 11.5,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <JIcon
          name={terminalSplit === 'bottom' ? 'split-h' : terminalSplit === 'side' ? 'split-v' : 'terminal'}
          size={11}
        />
        <span>Term</span>
        <span style={{ opacity: 0.7 }}>⌘\</span>
      </button>
      <StatusItem icon="claude">{describeClaude(worktree.claude)}</StatusItem>
      <StatusItem icon="cli">$ {project.path}</StatusItem>
    </footer>
  );
}
