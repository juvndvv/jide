import { useState, type ReactNode } from 'react';
import { JIcon } from '../icons/JIcon';
import { Kbd } from '../icons/Kbd';

export function SidebarRow({
  icon,
  children,
  onClick,
  kbd,
}: {
  icon: 'plus' | 'folder' | 'settings';
  children: ReactNode;
  onClick?: () => void;
  kbd?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        height: 28,
        border: 0,
        background: hover ? '#00000008' : 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        borderRadius: 6,
        textAlign: 'left',
        fontFamily: 'inherit',
        fontSize: 'inherit',
      }}
    >
      <JIcon name={icon} size={13} style={{ color: '#00000080' }} />
      <span style={{ flex: 1 }}>{children}</span>
      {kbd && <Kbd>{kbd}</Kbd>}
    </button>
  );
}
