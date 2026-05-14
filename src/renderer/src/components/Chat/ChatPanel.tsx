import { useEffect, type JSX } from 'react';
import type { WorktreeLayout } from '@shared/layout';
import { countLeaves, findLeaf, flattenLeafIds } from '@shared/layout';
import type { WorktreeLayoutOps } from '../../shortcuts/useWorktreeLayout';
import { useTheme } from '../../theme/useTheme';
import { useSessionsList } from '../../shortcuts/useSessionsList';
import { useSessionHotkey } from './useSessionHotkey';
import { SessionStrip } from './SessionStrip';
import { ChatGrid } from './ChatGrid';
import { EmptySessions } from './EmptySessions';

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

  // When a single session is loaded and NO pane has a session assigned yet,
  // auto-assign to the active pane so restored sessions appear without drag-and-drop.
  // This fires only when all leaves are unassigned (initial or post-hydration state).
  useEffect(() => {
    if (!layout || !ops) return;
    if (sessions.length !== 1) return;
    // Only auto-assign when the active leaf has no session AND the session is not
    // assigned to any other leaf (prevents fighting with user drag-and-drop).
    const activeLeaf = findLeaf(layout.panes, layout.activePaneId);
    if (!activeLeaf || activeLeaf.sessionId !== null) return;
    const sessionUuid = sessions[0]!.id.uuid;
    // Check if the session is already shown in another pane — if so, don't reassign.
    const assignedElsewhere = flattenLeafIds(layout.panes).some((id) => {
      if (id === layout.activePaneId) return false;
      const leaf = findLeaf(layout.panes, id);
      return leaf?.sessionId === sessionUuid;
    });
    if (!assignedElsewhere) {
      ops.assignToPane(layout.activePaneId, sessionUuid);
    }
  }, [sessions, layout, ops]);

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

  const safeLayout = layout;
  const safeOps = ops;
  const leafCount = countLeaves(safeLayout.panes);

  async function createAndAssign(): Promise<void> {
    const snap = await create();
    if (!snap) return;
    // In single-pane mode, always assign the new session to the pane.
    // In multi-pane mode, only auto-assign when the active pane has no session yet.
    const activeLeaf = findLeaf(safeLayout.panes, safeLayout.activePaneId);
    if (activeLeaf && (leafCount === 1 || activeLeaf.sessionId === null)) {
      safeOps.assignToPane(safeLayout.activePaneId, snap.id.uuid);
    }
  }

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
      {sessions.length === 0 ? (
        <EmptySessions
          onCreate={() => { void createAndAssign(); }}
          disabled={capReached}
        />
      ) : (
        <>
          <SessionStrip
            sessions={sessions}
            activeId={activeId}
            capReached={capReached}
            onSelect={(id) => {
              void setActive(id);
              // In single-pane mode, keep the pane in sync with the strip selection.
              if (leafCount === 1) {
                safeOps.assignToPane(safeLayout.activePaneId, id);
              }
            }}
            onRename={(id, title) => {
              void rename(id, title);
            }}
            onClose={(id) => {
              void kill(id);
            }}
            onNew={() => { void createAndAssign(); }}
          />
          <ChatGrid
            worktreeId={worktreeId}
            tree={safeLayout.panes}
            activeLeafId={safeLayout.activePaneId}
            leafCount={leafCount}
            ops={safeOps}
          />
        </>
      )}
    </div>
  );
}
