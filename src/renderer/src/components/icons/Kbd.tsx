import type { ReactNode } from 'react';
import { useTheme } from '../../theme/useTheme';

export function Kbd({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        marginLeft: 2,
        borderRadius: 4,
        background: theme.panelMuted,
        color: theme.textMed,
        border: `1px solid ${theme.borderHair}`,
        fontFamily: 'ui-monospace, monospace',
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}
