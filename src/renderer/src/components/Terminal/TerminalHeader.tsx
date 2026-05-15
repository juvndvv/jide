import type { CSSProperties, JSX } from 'react';
import { JIcon } from '../icons/JIcon.js';
import { useTheme } from '../../theme/useTheme.js';

export interface TerminalHeaderProps {
  shellName: string;
  path: string;
  orientation: 'bottom' | 'side';
  onToggleOrientation: () => void;
  onClose: () => void;
}

export function TerminalHeader({
  shellName,
  path,
  orientation,
  onToggleOrientation,
  onClose,
}: TerminalHeaderProps): JSX.Element {
  const { theme } = useTheme();
  return (
    <div
      data-testid="terminal-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 26,
        padding: '0 10px',
        background: theme.panelMuted,
        borderBottom: `1px solid ${theme.borderHair}`,
        color: theme.textMed,
        fontFamily: 'Geist, ui-monospace, monospace',
        fontSize: 11,
        flexShrink: 0,
      }}
    >
      <span style={{ color: theme.text, fontWeight: 600 }}>{shellName}</span>
      <span style={{ color: theme.textLow }}>·</span>
      <span
        style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {path}
      </span>
      <button
        type="button"
        aria-label="Cambiar orientación del terminal"
        title={orientation === 'bottom' ? 'Mover al lateral' : 'Mover abajo'}
        onClick={onToggleOrientation}
        style={iconButtonStyle(theme.textMed)}
      >
        <JIcon name={orientation === 'bottom' ? 'split-v' : 'split-h'} size={12} />
      </button>
      <button
        type="button"
        aria-label="Cerrar terminal"
        title="Cerrar terminal (⌘\\)"
        onClick={onClose}
        style={iconButtonStyle(theme.textMed)}
      >
        <JIcon name="x" size={12} />
      </button>
    </div>
  );
}

function iconButtonStyle(color: string): CSSProperties {
  return {
    border: 0,
    background: 'transparent',
    color,
    cursor: 'pointer',
    padding: 2,
    lineHeight: 0,
  };
}
