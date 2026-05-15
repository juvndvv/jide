import type { JSX } from 'react';
import { FixedSizeList } from 'react-window';
import type { UseFileTree } from '../../shortcuts/useFileTree';
import { FileTreeNode } from './FileTreeNode';
import { useTheme } from '../../theme/useTheme';

const VIRTUALIZE_THRESHOLD = 500;
const ROW_HEIGHT = 22;

export interface FileTreeProps extends UseFileTree {
  height: number;
  selectedPath: string | null;
  onSelect: (relPath: string) => void;
}

export function FileTree({
  rows,
  toggleExpand,
  height,
  selectedPath,
  onSelect,
  loadingRoot,
}: FileTreeProps): JSX.Element {
  const { theme } = useTheme();

  if (loadingRoot && rows.length === 0) {
    return <div style={{ padding: 12, color: theme.textMed, fontSize: 12 }}>Cargando…</div>;
  }
  if (rows.length === 0) {
    return <div style={{ padding: 12, color: theme.textMed, fontSize: 12 }}>(vacío)</div>;
  }

  if (rows.length < VIRTUALIZE_THRESHOLD) {
    return (
      <div style={{ overflow: 'auto', height, minHeight: 0 }}>
        {rows.map((row) => (
          <FileTreeNode
            key={row.node.relPath}
            row={row}
            selected={selectedPath === row.node.relPath}
            onToggleExpand={toggleExpand}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  return (
    <FixedSizeList
      height={height}
      itemCount={rows.length}
      itemSize={ROW_HEIGHT}
      width="100%"
    >
      {({ index, style }) => {
        const row = rows[index];
        if (!row) return null;
        return (
          <div style={style} key={row.node.relPath}>
            <FileTreeNode
              row={row}
              selected={selectedPath === row.node.relPath}
              onToggleExpand={toggleExpand}
              onSelect={onSelect}
            />
          </div>
        );
      }}
    </FixedSizeList>
  );
}
