import type { CSSProperties, JSX } from 'react';
import { JIcon } from '../icons/JIcon';
import { useTheme } from '../../theme/useTheme';

export interface PaneHeaderProps {
  title: string;
  status?: string;
  canSplit: boolean;
  canClose: boolean;
  isActive: boolean;
  onFocus: () => void;
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
  onClose: () => void;
}

export function PaneHeader({
  title,
  status,
  canSplit,
  canClose,
  isActive,
  onFocus,
  onSplitHorizontal,
  onSplitVertical,
  onClose,
}: PaneHeaderProps): JSX.Element {
  const { theme, accent } = useTheme();
  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 24,
    padding: '0 8px',
    background: isActive ? accent.value + '14' : theme.panelMuted,
    borderBottom: `1px solid ${theme.borderHair}`,
    cursor: 'pointer',
    fontFamily: 'Geist, ui-monospace, monospace',
    fontSize: 11,
    color: theme.textMed,
    flexShrink: 0,
  };
  return (
    <div data-testid="pane-header" onClick={onFocus} style={headerStyle}>
      <span
        style={{
          color: theme.text,
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {title}
      </span>
      {status && <span style={{ color: theme.textLow }}>{status}</span>}
      <button
        type="button"
        aria-label="Dividir abajo"
        title="Dividir abajo"
        disabled={!canSplit}
        onClick={(e) => {
          e.stopPropagation();
          onSplitHorizontal();
        }}
        style={iconButton(theme.textMed, !canSplit)}
      >
        <JIcon name="split-h" size={11} />
      </button>
      <button
        type="button"
        aria-label="Dividir lateral"
        title="Dividir lateral"
        disabled={!canSplit}
        onClick={(e) => {
          e.stopPropagation();
          onSplitVertical();
        }}
        style={iconButton(theme.textMed, !canSplit)}
      >
        <JIcon name="split-v" size={11} />
      </button>
      {canClose && (
        <button
          type="button"
          aria-label="Cerrar panel"
          title="Cerrar panel"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={iconButton(theme.textMed, false)}
        >
          <JIcon name="x" size={11} />
        </button>
      )}
    </div>
  );
}

function iconButton(color: string, disabled: boolean): CSSProperties {
  return {
    border: 0,
    background: 'transparent',
    color,
    cursor: disabled ? 'not-allowed' : 'pointer',
    padding: 2,
    lineHeight: 0,
    opacity: disabled ? 0.4 : 1,
  };
}
