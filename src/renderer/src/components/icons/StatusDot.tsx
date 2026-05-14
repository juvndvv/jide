import type { ClaudeState } from '@shared/project';
import { useTheme } from '../../theme/useTheme';

type DotState = ClaudeState | 'done' | 'clean';

export function StatusDot({ state, size = 7 }: { state: DotState; size?: number }) {
  const { theme, accent } = useTheme();

  const color = (() => {
    switch (state) {
      case 'idle':
        return theme.textLow;
      case 'running':
        return accent.value;
      case 'awaiting':
        return theme.warning;
      case 'error':
        return theme.error;
      case 'done':
        return theme.success;
      case 'clean':
        return 'transparent';
      default:
        return theme.textDisabled;
    }
  })();

  return (
    <span
      data-testid={`status-dot-${state}`}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: 999,
        background: color,
        animation: state === 'running' ? 'jidePulse 1.6s ease-out infinite' : 'none',
        flexShrink: 0,
      }}
    />
  );
}
