import { useCallback, useEffect, useRef, type JSX } from 'react';
import { useTheme } from '../../theme/useTheme.js';
import { useTerminal } from '../../shortcuts/useTerminal.js';
import { useXterm } from './useXterm.js';
import { TerminalHeader } from './TerminalHeader.js';

export interface TerminalPanelProps {
  worktreeId: string;
  cwd: string;
  shellName: string;
  orientation: 'bottom' | 'side';
  onToggleOrientation: () => void;
  onClose: () => void;
}

export function TerminalPanel({
  worktreeId,
  cwd,
  shellName,
  orientation,
  onToggleOrientation,
  onClose,
}: TerminalPanelProps): JSX.Element {
  const { theme, accent } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const term = useTerminal(worktreeId);

  const onUserInput = useCallback((data: string) => { void term.write(data); }, [term]);
  const onResize = useCallback(
    (cols: number, rows: number) => { void term.resize(cols, rows); },
    [term],
  );

  const { writeChunk } = useXterm({ containerRef, theme, accent, onUserInput, onResize });

  useEffect(() => {
    void term.ensureCreated(cwd, 80, 24);
  }, [term, cwd]);

  useEffect(() => {
    return term.onData(writeChunk);
  }, [term, writeChunk]);

  return (
    <div
      data-testid="terminal-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: theme.codeBg,
        flex: 1,
      }}
    >
      <TerminalHeader
        shellName={shellName}
        path={cwd}
        orientation={orientation}
        onToggleOrientation={onToggleOrientation}
        onClose={onClose}
      />
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
}
