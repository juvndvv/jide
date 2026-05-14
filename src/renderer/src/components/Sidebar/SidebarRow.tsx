import { forwardRef, useState, type ReactNode, type Ref } from 'react';
import { JIcon } from '../icons/JIcon';
import { Kbd } from '../icons/Kbd';
import { useTheme } from '../../theme/useTheme';

interface SidebarRowProps {
  icon: 'plus' | 'folder' | 'settings';
  children: ReactNode;
  onClick?: () => void;
  kbd?: string;
  anchorRef?: Ref<HTMLButtonElement | null>;
  'data-testid'?: string;
}

export const SidebarRow = forwardRef<HTMLButtonElement, SidebarRowProps>(function SidebarRow(
  { icon, children, onClick, kbd, anchorRef, 'data-testid': testId },
  _ref,
) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  return (
    <button
      ref={anchorRef}
      type="button"
      data-testid={testId}
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
        background: hover ? theme.hoverBg : 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        borderRadius: 6,
        textAlign: 'left',
        fontFamily: 'inherit',
        fontSize: 'inherit',
      }}
    >
      <JIcon name={icon} size={13} style={{ color: theme.textMed }} />
      <span style={{ flex: 1 }}>{children}</span>
      {kbd && <Kbd>{kbd}</Kbd>}
    </button>
  );
});
