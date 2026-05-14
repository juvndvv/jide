import { JIcon } from '../icons/JIcon';
import { useTheme } from '../../theme/useTheme';

interface PaletteButtonProps {
  onClick?: () => void;
}

export function PaletteButton({ onClick }: PaletteButtonProps): JSX.Element {
  const { theme } = useTheme();
  const handle = onClick ?? ((): void => {
    console.warn('[jide] command palette: pending Fase 8');
  });
  return (
    <button
      type="button"
      aria-label="Abrir paleta de comandos (⌘K)"
      data-testid="palette-button"
      onClick={handle}
      style={{
        WebkitAppRegion: 'no-drag',
        height: 22,
        padding: '0 8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        borderRadius: 5,
        border: `1px solid ${theme.border}`,
        background: theme.panelMuted,
        color: theme.textMed,
        cursor: 'pointer',
        fontSize: 11,
        fontFamily: 'inherit',
      } as React.CSSProperties}
    >
      <JIcon name="command" size={10} />
      <span>K</span>
    </button>
  );
}
