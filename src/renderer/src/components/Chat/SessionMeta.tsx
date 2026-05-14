import type { SessionSnapshot } from '@shared/session';

export interface SessionMetaProps {
  snapshot: SessionSnapshot;
}

export function SessionMeta({ snapshot }: SessionMetaProps) {
  return (
    <div
      data-testid="session-meta"
      style={{
        display: 'flex',
        gap: 12,
        padding: '4px 12px',
        fontSize: 11,
        color: '#00000080',
        fontFamily: 'ui-monospace, monospace',
        borderBottom: '1px solid #00000008',
        background: '#00000003',
      }}
    >
      <span data-testid="session-meta-model">model: {snapshot.model}</span>
      <span data-testid="session-meta-status">status: {snapshot.status}</span>
      <span data-testid="session-meta-tokens">tokens: —</span>
      <span data-testid="session-meta-ctx">ctx: —</span>
      <span data-testid="session-meta-cost">
        ${snapshot.totalCostUsd.toFixed(4)}
      </span>
    </div>
  );
}
