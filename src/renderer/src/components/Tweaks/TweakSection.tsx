import type { JSX, ReactNode } from 'react';
import { useTheme } from '../../theme/useTheme';

export interface TweakSectionProps {
  label: string;
  children: ReactNode;
}

export function TweakSection({ label, children }: TweakSectionProps): JSX.Element {
  const { theme } = useTheme();
  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          padding: '4px 0',
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: theme.textLow,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}
