import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../theme/useTheme';
import { useFileTree } from '../../shortcuts/useFileTree';
import { useFileContent } from '../../shortcuts/useFileContent';
import { FileTree } from './FileTree';
import { FileContent } from './FileContent';
import { SplitContainer } from '../Worktree/SplitContainer';
import { EmptyViewer } from './EmptyViewer';

export interface FileViewerPanelProps {
  worktreeId: string;
  selectedPath: string | null;
  onSelect: (relPath: string) => void;
  onClose: () => void;
}

export function FileViewerPanel({
  worktreeId,
  selectedPath,
  onSelect,
  onClose,
}: FileViewerPanelProps): JSX.Element {
  const { theme } = useTheme();
  const treeApi = useFileTree(worktreeId);
  const contentApi = useFileContent(worktreeId, selectedPath);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const [treeHeight, setTreeHeight] = useState(400);

  useEffect(() => {
    const el = treeContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      setTreeHeight(Math.max(50, h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      data-testid="file-viewer-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: theme.panelBg,
        borderRight: `1px solid ${theme.borderHair}`,
        minWidth: 0,
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          height: 32,
          fontSize: 11,
          color: theme.textMed,
          borderBottom: `1px solid ${theme.borderHair}`,
          flexShrink: 0,
        }}
      >
        <span>Visor</span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar visor"
          style={{
            background: 'transparent',
            border: 'none',
            color: theme.textMed,
            cursor: 'pointer',
            fontSize: 12,
            padding: 0,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <SplitContainer
          axis="v"
          ratio={0.4}
          first={
            <div
              ref={treeContainerRef}
              style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}
            >
              <FileTree
                {...treeApi}
                height={treeHeight}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            </div>
          }
          second={
            selectedPath ? (
              <FileContent result={contentApi.result} loading={contentApi.loading} />
            ) : (
              <EmptyViewer />
            )
          }
        />
      </div>
    </div>
  );
}
