import type { ClaudeState } from '@shared/project';

type DotState = ClaudeState | 'done' | 'clean';

const COLORS: Record<DotState, string> = {
  running: '#F95A5C',
  awaiting: '#F59E0B',
  idle: '#B8B8B8',
  error: '#ED5A46',
  done: '#10B981',
  clean: 'transparent',
};

export function StatusDot({ state, size = 7 }: { state: DotState; size?: number }) {
  const pulse = state === 'running';
  return (
    <span
      data-testid={`status-dot-${state}`}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: 999,
        background: COLORS[state],
        animation: pulse ? 'jidePulse 1.6s ease-out infinite' : 'none',
        flexShrink: 0,
      }}
    />
  );
}
