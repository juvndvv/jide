import type { JSX } from 'react';
import type { WorktreeLayout } from '@shared/layout';
import { countLeaves } from '@shared/layout';
import type { WorktreeLayoutOps } from '../../shortcuts/useWorktreeLayout';
import { useTheme } from '../../theme/useTheme';
import { useSessionsList } from '../../shortcuts/useSessionsList';
import { useSessionHotkey } from './useSessionHotkey';
import { SessionStrip } from './SessionStrip';
import { ChatGrid } from './ChatGrid';

const DEFAULT_MAX_SESSIONS = 4;

export interface ChatPanelProps {
  worktreeId: string | null;
  maxSessionsPerWorktree?: number;
  layout: WorktreeLayout | null;
  ops: WorktreeLayoutOps | null;
}

export function ChatPanel({
  worktreeId,
  maxSessionsPerWorktree = DEFAULT_MAX_SESSIONS,
  layout,
  ops,
}: ChatPanelProps): JSX.Element {
  const { theme } = useTheme();
  const { sessions, activeId, setActive, create, rename, kill, capReached } =
    useSessionsList(worktreeId, maxSessionsPerWorktree);
  useSessionHotkey(worktreeId !== null && !capReached, () => {
    void create();
  });

  if (!worktreeId || !layout || !ops) {
    return (
      <div
        data-testid="chat-panel-empty"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.textLow,
          fontFamily: 'ui-monospace, monospace',
          fontSize: 14,
          background: theme.panelBg,
        }}
      >
        Selecciona un worktree
      </div>
    );
  }

  const leafCount = countLeaves(layout.panes);

  return (
    <div
      data-testid="chat-panel"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: theme.panelBg,
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      <SessionStrip
        sessions={sessions}
        activeId={activeId}
        capReached={capReached}
        onSelect={(id) => {
          void setActive(id);
        }}
        onRename={(id, title) => {
          void rename(id, title);
        }}
        onClose={(id) => {
          void kill(id);
        }}
        onNew={() => {
          void create();
        }}
      />
      <ChatGrid
        worktreeId={worktreeId}
        tree={layout.panes}
        activeLeafId={layout.activePaneId}
        leafCount={leafCount}
        ops={ops}
      />
    </div>
  );
}
