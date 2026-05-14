import type { SessionSnapshot } from '@shared/session';
import { useTheme } from '../../theme/useTheme';

export interface SessionMetaProps {
  snapshot: SessionSnapshot;
}

export function SessionMeta({ snapshot }: SessionMetaProps) {
  const { theme } = useTheme();
  return (
    <div
      data-testid="session-meta"
      style={{
        display: 'flex',
        gap: 12,
        padding: '4px 12px',
        fontSize: 11,
        color: theme.textMed,
        fontFamily: 'ui-monospace, monospace',
        borderBottom: `1px solid ${theme.borderHair}`,
        background: theme.hoverBg,
      }}
    >
      <span data-testid="session-meta-model">model: {snapshot.model}</span>
      <span data-testid="session-meta-status">status: {snapshot.status}</span>
      <span data-testid="session-meta-tokens">tokens: —</span>
      <span data-testid="session-meta-ctx">ctx: —</span>
      <span data-testid="session-meta-cost">${snapshot.totalCostUsd.toFixed(4)}</span>
    </div>
  );
}
