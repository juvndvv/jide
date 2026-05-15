import { useEffect, useRef, type JSX, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../theme/useTheme';
import { useIsTopOverlay, useOverlayStack } from './OverlayStackContext';
import { useFocusTrap } from './useFocusTrap';

export interface OverlayProps {
  id: string;
  z?: number;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  ariaLabel: string;
  dataTestId?: string;
  children: ReactNode;
}

export function Overlay(props: OverlayProps): JSX.Element {
  const {
    id,
    z = 100,
    onClose,
    closeOnBackdrop = true,
    ariaLabel,
    dataTestId,
    children,
  } = props;

  const { theme } = useTheme();
  const stack = useOverlayStack();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    stack.push({ id, z, onEsc: () => onCloseRef.current() });
    return () => {
      stack.remove(id);
    };
  }, [stack, id, z]);

  useFocusTrap(rootRef);

  const isTop = useIsTopOverlay(id);

  const onBackdropClick = (): void => {
    if (closeOnBackdrop) onClose();
  };

  const onContentClick = (e: MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation();
  };

  const node = (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      data-overlay-id={id}
      data-is-top={String(isTop)}
      {...(dataTestId ? { 'data-testid': dataTestId } : {})}
      onClick={onBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: theme.scrim,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: z,
      }}
    >
      {/* display:contents so children remain direct flex items of the root while still capturing the stopPropagation click */}
      <div onClick={onContentClick} style={{ display: 'contents' }}>
        {children}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
