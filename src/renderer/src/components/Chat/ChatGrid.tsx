import type { JSX } from 'react';
import type { PaneTree } from '@shared/layout';
import type { WorktreeLayoutOps } from '../../shortcuts/useWorktreeLayout';
import { ChatPane } from './ChatPane';
import { SplitContainer } from '../Worktree/SplitContainer';

export interface ChatGridProps {
  worktreeId: string;
  tree: PaneTree;
  activeLeafId: string;
  leafCount: number;
  ops: WorktreeLayoutOps;
}

export function ChatGrid({ worktreeId, tree, activeLeafId, leafCount, ops }: ChatGridProps): JSX.Element {
  return renderNode(tree, worktreeId, activeLeafId, leafCount, ops);
}

function renderNode(
  node: PaneTree,
  worktreeId: string,
  activeLeafId: string,
  leafCount: number,
  ops: WorktreeLayoutOps,
): JSX.Element {
  if (node.kind === 'leaf') {
    return (
      <ChatPane
        worktreeId={worktreeId}
        leafId={node.id}
        sessionId={node.sessionId}
        isActive={node.id === activeLeafId}
        canSplit={leafCount < 4}
        canClose={leafCount > 1}
        onFocus={() => ops.setActivePane(node.id)}
        onSplitHorizontal={() => {
          ops.setActivePane(node.id);
          ops.splitActivePane('h');
        }}
        onSplitVertical={() => {
          ops.setActivePane(node.id);
          ops.splitActivePane('v');
        }}
        onClose={() => ops.mergePane(node.id)}
        onAssignSession={(sessionId) => ops.dropToPane(node.id, sessionId)}
      />
    );
  }
  return (
    <SplitContainer
      axis={node.axis}
      ratio={node.ratio}
      first={renderNode(node.first, worktreeId, activeLeafId, leafCount, ops)}
      second={renderNode(node.second, worktreeId, activeLeafId, leafCount, ops)}
    />
  );
}
