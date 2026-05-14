import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
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
        background: '#00000010',
        color: '#00000080',
        border: '1px solid #00000018',
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
