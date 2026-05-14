import { useState } from 'react';
import type { Worktree } from '@shared/project';
import { JIcon } from '../icons/JIcon';
import { StatusDot } from '../icons/StatusDot';

const ACCENT = '#F95A5C';

export function WorktreeRow({
  worktree,
  active,
  onClick,
}: {
  worktree: Worktree;
  active: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const bg = active ? ACCENT + '1F' : hover ? '#00000008' : 'transparent';
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
          background: active ? ACCENT : 'transparent',
          borderRadius: 2,
        }}
      />
      <JIcon name="branch" size={12} style={{ color: active ? ACCENT : '#00000060' }} />
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
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#00000060' }}
        >
          ↑{worktree.ahead}
        </span>
      )}
      {worktree.behind > 0 && (
        <span
          data-testid={`worktree-behind-${worktree.branch}`}
          title={`${worktree.behind} commits behind upstream`}
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#00000060' }}
        >
          ↓{worktree.behind}
        </span>
      )}
      {worktree.changes > 0 && (
        <span
          data-testid={`worktree-changes-${worktree.branch}`}
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#00000060' }}
        >
          {worktree.changes}
        </span>
      )}
      <StatusDot state={worktree.claude} />
    </button>
  );
}
