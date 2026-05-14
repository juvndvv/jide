import type { JSX } from 'react';
import type { Worktree } from '@shared/project';
import type { WorktreeLayout } from '@shared/layout';
import type { WorktreeLayoutOps } from '../../shortcuts/useWorktreeLayout';
import { ChatPanel } from '../Chat/ChatPanel';
import { TerminalPanel } from '../Terminal/TerminalPanel';
import { SplitContainer } from './SplitContainer';

export interface WorktreeViewProps {
  worktreeId: string | null;
  worktree: Worktree | null;
  shellName: string;
  maxSessionsPerWorktree: number;
  layout: WorktreeLayout;
  ops: WorktreeLayoutOps;
}

export function WorktreeView({
  worktreeId, worktree, shellName, maxSessionsPerWorktree, layout, ops,
}: WorktreeViewProps): JSX.Element {
  const chat = (
    <ChatPanel
      worktreeId={worktreeId}
      maxSessionsPerWorktree={maxSessionsPerWorktree}
      layout={layout}
      ops={ops}
    />
  );

  if (!worktreeId || !worktree || layout.terminal === 'off') {
    return chat;
  }

  const terminal = (
    <TerminalPanel
      worktreeId={worktreeId}
      cwd={worktree.path}
      shellName={shellName}
      orientation={layout.terminal}
      onToggleOrientation={ops.toggleTerminalOrientation}
      onClose={ops.closeTerminal}
    />
  );

  return (
    <SplitContainer
      axis={layout.terminal === 'bottom' ? 'h' : 'v'}
      ratio={layout.terminalRatio}
      first={chat}
      second={terminal}
    />
  );
}
