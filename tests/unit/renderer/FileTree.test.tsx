// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JSX, ReactNode } from 'react';
import type { FlatTreeRow } from '../../../src/renderer/src/shortcuts/useFileTree';
import { FileTree } from '../../../src/renderer/src/components/FileViewer/FileTree';
import { ThemeProvider } from '../../../src/renderer/src/theme/ThemeProvider';

function Wrapper({ children }: { children: ReactNode }): JSX.Element {
  const persist = {
    setMode: vi.fn(),
    setAccent: vi.fn(),
    setDensity: vi.fn(),
    setSidebarSide: vi.fn(),
  };
  return (
    <ThemeProvider
      initial={{ mode: 'light', accent: 'coral', density: 'comfy', sidebarSide: 'left' }}
      persist={persist}
    >
      {children}
    </ThemeProvider>
  );
}

function makeRow(rel: string, kind: 'file' | 'dir', depth: number): FlatTreeRow {
  return {
    node: { name: rel.split('/').pop()!, relPath: rel, kind, sizeBytes: kind === 'file' ? 0 : null },
    depth,
    isExpanded: false,
    status: null,
  };
}

describe('FileTree', () => {
  it('renders empty placeholder when no rows', () => {
    render(
      <Wrapper>
        <FileTree
          rows={[]}
          loadingRoot={false}
          toggleExpand={() => {}}
          refresh={() => {}}
          height={400}
          selectedPath={null}
          onSelect={() => {}}
        />
      </Wrapper>,
    );
    expect(screen.getByText(/vacío/i)).toBeTruthy();
  });

  it('shows loading placeholder when loadingRoot and no rows yet', () => {
    render(
      <Wrapper>
        <FileTree
          rows={[]}
          loadingRoot={true}
          toggleExpand={() => {}}
          refresh={() => {}}
          height={400}
          selectedPath={null}
          onSelect={() => {}}
        />
      </Wrapper>,
    );
    expect(screen.getByText(/cargando/i)).toBeTruthy();
  });

  it('renders rows below virtualization threshold without FixedSizeList', () => {
    const rows: FlatTreeRow[] = [
      makeRow('src', 'dir', 0),
      makeRow('src/a.ts', 'file', 1),
      makeRow('src/b.ts', 'file', 1),
    ];
    render(
      <Wrapper>
        <FileTree
          rows={rows}
          loadingRoot={false}
          toggleExpand={() => {}}
          refresh={() => {}}
          height={400}
          selectedPath="src/a.ts"
          onSelect={() => {}}
        />
      </Wrapper>,
    );
    expect(screen.getAllByTestId('file-tree-node')).toHaveLength(3);
  });
});
