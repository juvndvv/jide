import type { Project, Worktree } from '@shared/project';
import { useTheme } from '../../theme/useTheme';

interface StatusBarProps {
  project: Project | null;
  worktree: Worktree | null;
}

// Full implementation lands in Task 8. This stub renders the accent band so
// the layout reserves space and the band reacts to accent changes.
export function StatusBar(_props: StatusBarProps): JSX.Element {
  const { accent } = useTheme();
  return (
    <footer
      data-testid="status-bar"
      style={{
        height: 26,
        flexShrink: 0,
        background: accent.value,
        color: '#FFFFFF',
      }}
    />
  );
}
