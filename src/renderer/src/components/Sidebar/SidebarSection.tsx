import type { CSSProperties, ReactNode } from 'react';

export function SidebarSection({
  label,
  children,
  style,
}: {
  label: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ marginBottom: 8, ...style }}>
      <div
        style={{
          padding: '8px 10px 4px',
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: '#00000060',
        }}
      >
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
