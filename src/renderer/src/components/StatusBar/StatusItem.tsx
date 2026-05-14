import type { CSSProperties, ReactNode } from 'react';
import { JIcon } from '../icons/JIcon';

export type StatusIconName = 'branch' | 'arrow-up' | 'arrow-down' | 'diff' | 'claude' | 'cli';

export interface StatusItemProps {
  icon: StatusIconName;
  children: ReactNode;
  style?: CSSProperties;
}

export function StatusItem({ icon, children, style }: StatusItemProps): JSX.Element {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '0 10px',
        height: '100%',
        ...style,
      }}
    >
      <JIcon name={icon} size={11} style={{ opacity: 0.85 }} />
      <span style={{ opacity: 0.95 }}>{children}</span>
    </span>
  );
}
