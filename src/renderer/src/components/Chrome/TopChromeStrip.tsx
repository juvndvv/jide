import type { Project, Worktree } from '@shared/project';
import { useTheme } from '../../theme/useTheme';

interface TopChromeStripProps {
  project: Project | null;
  worktree: Worktree | null;
}

// Full implementation lands in Task 7. This stub renders the band so the shell
// reserves space and dark/light swaps work end-to-end.
export function TopChromeStrip(_props: TopChromeStripProps): JSX.Element {
  const { theme, sidebarSide } = useTheme();
  const padLeft = sidebarSide === 'left' ? 78 : 16;
  const padRight = sidebarSide === 'right' ? 78 : 16;
  return (
    <div
      data-testid="top-chrome"
      style={{
        height: 30,
        flexShrink: 0,
        background: theme.appBg,
        borderBottom: `1px solid ${theme.borderHair}`,
        padding: `0 ${padRight}px 0 ${padLeft}px`,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    />
  );
}
