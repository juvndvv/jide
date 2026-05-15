import type { JSX } from 'react';
import type { Project, Worktree } from '@shared/project';
import { JIcon } from '../icons/JIcon';
import { useTheme } from '../../theme/useTheme';
import { PaletteButton } from './PaletteButton';

export interface TopChromeStripProps {
  project: Project | null;
  worktree: Worktree | null;
}

export function TopChromeStrip({ project, worktree }: TopChromeStripProps): JSX.Element {
  const { theme, sidebarSide } = useTheme();
  const padLeft = sidebarSide === 'left' ? 78 : 16;
  const padRight = sidebarSide === 'right' ? 78 : 16;
  const showBreadcrumb = project !== null && worktree !== null;
  return (
    <div
      data-testid="top-chrome"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        height: 38,
        padding: `0 ${padRight}px 0 ${padLeft}px`,
        background: theme.appBg,
        flexShrink: 0,
        borderBottom: `1px solid ${theme.borderHair}`,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      <div style={{ flex: 1 }} />
      {showBreadcrumb && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: theme.textMed,
            fontSize: 12,
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
        >
          <JIcon name="folder" size={12} />
          <span style={{ fontFamily: 'Geist, monospace' }}>{project.name}</span>
          <span style={{ color: theme.textLow }}>/</span>
          <span style={{ fontFamily: 'Geist, monospace', color: theme.text, fontWeight: 600 }}>
            {worktree.branch}
          </span>
          {worktree.changes > 0 && (
            <span
              style={{
                marginLeft: 6,
                padding: '1px 6px',
                borderRadius: 4,
                background: theme.warning + '1F',
                color: theme.warning,
                fontFamily: 'Geist, monospace',
                fontSize: 10.5,
                fontWeight: 600,
              }}
            >
              {worktree.changes} cambios
            </span>
          )}
        </div>
      )}
      <div style={{ flex: 1 }} />
      <PaletteButton />
    </div>
  );
}
