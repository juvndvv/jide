import { useState } from 'react';
import { useTheme } from '../../theme/useTheme';

export interface ApprovalBarProps {
  /** When null, the bar is hidden. */
  awaitingToolUseId: string | null;
  /** Tool name display, e.g. 'Bash'. */
  toolName: string | null;
  /** Called when the user clicks Approve / Reject. */
  onApprove: (toolUseId: string) => void;
  onReject: (toolUseId: string, reason: string) => void;
}

export function ApprovalBar({
  awaitingToolUseId,
  toolName,
  onApprove,
  onReject,
}: ApprovalBarProps) {
  const { theme, accent } = useTheme();
  const [reason, setReason] = useState('');
  // Hidden when no tool is awaiting approval; lets callers mount unconditionally.
  // Phase 3 ships with bypassPermissions so this path never triggers at runtime.
  if (!awaitingToolUseId) return null;
  return (
    <div
      data-testid="approval-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        background: theme.warning + '1F',
        borderTop: `1px solid ${theme.borderHair}`,
        fontSize: 13,
      }}
    >
      <span style={{ color: theme.warning, fontWeight: 600 }}>
        {toolName ?? 'Tool'} awaiting approval
      </span>
      <input
        type="text"
        data-testid="approval-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Optional reason"
        style={{
          flex: 1,
          padding: '4px 8px',
          border: `1px solid ${theme.borderHair}`,
          borderRadius: 6,
          fontFamily: 'inherit',
          fontSize: 12,
        }}
      />
      <button
        type="button"
        data-testid="approval-reject"
        onClick={() => onReject(awaitingToolUseId, reason)}
        style={{
          padding: '6px 12px',
          border: `1px solid ${theme.error}`,
          background: theme.panelBg,
          color: theme.error,
          borderRadius: 6,
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Reject
      </button>
      <button
        type="button"
        data-testid="approval-approve"
        onClick={() => onApprove(awaitingToolUseId)}
        style={{
          padding: '6px 12px',
          border: 'none',
          background: accent.value,
          color: '#FFFFFF',
          borderRadius: 6,
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Approve
      </button>
    </div>
  );
}
