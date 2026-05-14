import { useState } from 'react';
import type { Worktree } from '@shared/project';
import { JIcon } from '../icons/JIcon';
import { StatusDot } from '../icons/StatusDot';
import { useTheme } from '../../theme/useTheme';

export function WorktreeRow({
  worktree,
  active,
  onClick,
}: {
  worktree: Worktree;
  active: boolean;
  onClick: () => void;
}) {
  const { theme, accent } = useTheme();
  const [hover, setHover] = useState(false);
  const bg = active ? accent.value + '1F' : hover ? theme.hoverBg : 'transparent';
  return (
    <button
      type="button"
      data-testid={`worktree-${worktree.branch}`}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px 0 28px',
        height: 26,
        border: 0,
        background: bg,
        color: 'inherit',
        cursor: 'pointer',
        borderRadius: 6,
        textAlign: 'left',
        position: 'relative',
        fontFamily: 'inherit',
        fontSize: 12,
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: 14,
          top: '20%',
          bottom: '20%',
          width: 2,
          background: active ? accent.value : 'transparent',
          borderRadius: 2,
        }}
      />
      <JIcon name="branch" size={12} style={{ color: active ? accent.value : theme.textMed }} />
      <span
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 12,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: active ? 600 : 500,
        }}
      >
        {worktree.branch}
      </span>
      {worktree.ahead > 0 && (
        <span
          data-testid={`worktree-ahead-${worktree.branch}`}
          title={`${worktree.ahead} commits ahead of upstream`}
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: theme.textMed }}
        >
          ↑{worktree.ahead}
        </span>
      )}
      {worktree.behind > 0 && (
        <span
          data-testid={`worktree-behind-${worktree.branch}`}
          title={`${worktree.behind} commits behind upstream`}
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: theme.textMed }}
        >
          ↓{worktree.behind}
        </span>
      )}
      {worktree.changes > 0 && (
        <span
          data-testid={`worktree-changes-${worktree.branch}`}
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: theme.textMed }}
        >
          {worktree.changes}
        </span>
      )}
      <StatusDot state={worktree.claude} />
    </button>
  );
}
