import { useTheme } from '../../theme/useTheme';

export interface EmptySessionsProps {
  onCreate: () => void;
  disabled: boolean;
}

export function EmptySessions({ onCreate, disabled }: EmptySessionsProps) {
  const { theme, accent } = useTheme();
  return (
    <div
      data-testid="empty-sessions"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: theme.textMed,
        fontFamily: 'ui-monospace, monospace',
        fontSize: 13,
      }}
    >
      <p>No hay sesiones aún en este worktree.</p>
      <button
        type="button"
        data-testid="empty-sessions-cta"
        disabled={disabled}
        onClick={onCreate}
        style={{
          padding: '8px 16px',
          border: 'none',
          borderRadius: 6,
          background: accent.value,
          color: '#FFFFFF',
          fontFamily: 'inherit',
          fontSize: 12,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        Nueva sesión <span style={{ opacity: 0.6 }}>⌘T</span>
      </button>
    </div>
  );
}
