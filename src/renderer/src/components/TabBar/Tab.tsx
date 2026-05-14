import { useState } from 'react';
import type { Project, Worktree } from '@shared/project';
import { useTheme } from '../../theme/useTheme';
import { StatusDot } from '../icons/StatusDot';
import { JIcon } from '../icons/JIcon';

interface TabProps {
  project: Project;
  worktree: Worktree;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}

export function Tab({ project, worktree, active, onSelect, onClose }: TabProps): JSX.Element {
  const { theme, accent, density } = useTheme();
  const [hover, setHover] = useState(false);
  const [hoverX, setHoverX] = useState(false);

  const background = active ? theme.panelBg : hover ? theme.hoverBg : 'transparent';

  return (
    <div
      role="tab"
      aria-selected={active}
      data-testid={`tab-${worktree.id}`}
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        height: density.tabH,
        padding: '0 10px 0 12px',
        marginTop: 4,
        background,
        borderRight: `1px solid ${theme.borderHair}`,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        userSelect: 'none',
        flexShrink: 0,
        maxWidth: 200,
      }}
    >
      {active && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: -4,
            height: 2,
            background: accent.value,
          }}
        />
      )}

      <StatusDot state={worktree.claude} size={6} />

      <span
        style={{
          fontFamily: "'Open Sauce One', sans-serif",
          fontSize: 11,
          color: theme.textMed,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {project.name}
      </span>

      <span style={{ color: theme.textLow, flexShrink: 0, fontSize: 11 }}>/</span>

      <span
        style={{
          fontFamily: "'Open Sauce One', sans-serif",
          fontSize: 11,
          color: theme.textMed,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
      >
        {worktree.branch}
      </span>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onMouseEnter={() => setHoverX(true)}
        onMouseLeave={() => setHoverX(false)}
        aria-label={`Cerrar ${worktree.branch}`}
        style={{
          width: 18,
          height: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 0,
          borderRadius: 3,
          background: hoverX ? theme.selectedBg : 'transparent',
          color: theme.textMed,
          cursor: 'pointer',
          flexShrink: 0,
          padding: 0,
        }}
      >
        {worktree.changes > 0 && !hoverX ? (
          <span
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: 999,
              background: theme.textMed,
            }}
          />
        ) : (
          <JIcon name="x" size={12} />
        )}
      </button>
    </div>
  );
}
