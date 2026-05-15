import type { JSX } from 'react';
import type { FlatTreeRow } from '../../shortcuts/useFileTree';
import { useTheme } from '../../theme/useTheme';
import { FileBadge } from './FileBadge';

export interface FileTreeNodeProps {
  row: FlatTreeRow;
  selected: boolean;
  onToggleExpand: (relPath: string) => void;
  onSelect: (relPath: string) => void;
}

export function FileTreeNode({
  row,
  selected,
  onToggleExpand,
  onSelect,
}: FileTreeNodeProps): JSX.Element {
  const { theme, accent } = useTheme();
  const { node, depth, isExpanded } = row;

  const handleClick = (): void => {
    if (node.kind === 'dir') {
      onToggleExpand(node.relPath);
      return;
    }
    onSelect(node.relPath);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 8 + depth * 12,
        paddingRight: 8,
        height: 22,
        cursor: 'pointer',
        background: selected ? accent.value + '1F' : undefined,
        color: theme.text,
        fontSize: 12,
      }}
      data-testid="file-tree-node"
      data-rel-path={node.relPath}
    >
      <span style={{ width: 12, color: theme.textLow, fontSize: 10, textAlign: 'center' }}>
        {node.kind === 'dir' ? (isExpanded ? '▾' : '▸') : ' '}
      </span>
      <span style={{ marginLeft: 4, color: node.kind === 'dir' ? theme.text : theme.textMed }}>
        {node.name}
      </span>
      <span style={{ flex: 1 }} />
      <FileBadge status={row.status} />
    </div>
  );
}
