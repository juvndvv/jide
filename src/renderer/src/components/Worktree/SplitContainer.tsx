import type { JSX, ReactNode } from 'react';
import { useTheme } from '../../theme/useTheme';

export interface SplitContainerProps {
  /** 'h' = horizontal divider (the children stack as rows). 'v' = vertical divider (children sit as columns). */
  axis: 'h' | 'v';
  /** Ratio of the first child (0..1). */
  ratio: number;
  first: ReactNode;
  second: ReactNode;
}

export function SplitContainer({ axis, ratio, first, second }: SplitContainerProps): JSX.Element {
  const { theme } = useTheme();
  const flexDir = axis === 'v' ? 'row' : 'column';
  return (
    <div
      data-testid="split-container"
      style={{
        display: 'flex',
        flexDirection: flexDir,
        flex: 1,
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <div style={{ flex: ratio, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {first}
      </div>
      <div
        aria-hidden
        style={{
          background: theme.borderHair,
          width: axis === 'v' ? '1px' : '100%',
          height: axis === 'v' ? '100%' : '1px',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 - ratio, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {second}
      </div>
    </div>
  );
}
