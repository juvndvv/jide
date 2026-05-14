import { useEffect, useLayoutEffect, useRef, useState, type JSX, type RefObject } from 'react';
import { useTheme } from '../../theme/useTheme';
import type { SidebarSide } from '../../theme/tokens';
import { TweakSection } from './TweakSection';
import { TweakRadio } from './TweakRadio';
import { TweakColor } from './TweakColor';

export interface TweaksPanelProps {
  anchorRef: RefObject<HTMLButtonElement | null>;
  side: SidebarSide;
  onClose: () => void;
}

const PANEL_WIDTH = 260;

export function TweaksPanel({ anchorRef, side, onClose }: TweaksPanelProps): JSX.Element {
  const { theme, mode, accent, density, sidebarSide, setMode, setAccent, setDensity, setSidebarSide } =
    useTheme();
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const left = side === 'left' ? rect.right + 6 : rect.left - PANEL_WIDTH - 6;
    setPosition({ top: rect.top, left });
  }, [anchorRef, side]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [anchorRef, onClose]);

  return (
    <>
      {position && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Tweaks"
          data-testid="tweaks-panel"
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            width: PANEL_WIDTH,
            padding: 12,
            background: theme.panelBg,
            color: theme.text,
            border: `1px solid ${theme.border}`,
            borderRadius: 10,
            boxShadow: theme.popoverShadow,
            zIndex: 50,
            fontFamily: 'inherit',
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13 }}>Tweaks · jide</div>

          <TweakSection label="Tema">
            <TweakRadio
              label="Modo"
              value={mode}
              options={[
                { value: 'light', label: 'light' },
                { value: 'dark', label: 'dark' },
                { value: 'auto', label: 'auto' },
              ]}
              onChange={setMode}
            />
            <TweakColor label="Acento" value={accent.id} onChange={setAccent} />
          </TweakSection>

          <TweakSection label="Layout">
            <TweakRadio
              label="Densidad"
              value={density.row === 24 ? 'compact' : 'comfy'}
              options={[
                { value: 'compact', label: 'compact' },
                { value: 'comfy', label: 'comfy' },
              ]}
              onChange={setDensity}
            />
            <TweakRadio
              label="Sidebar"
              value={sidebarSide}
              options={[
                { value: 'left', label: 'izq' },
                { value: 'right', label: 'der' },
              ]}
              onChange={setSidebarSide}
            />
          </TweakSection>
        </div>
      )}
    </>
  );
}
