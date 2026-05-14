import { useState, type JSX, type ReactNode } from 'react';
import { useTheme } from '../../theme/useTheme';

export const SESSION_DRAG_MIME = 'application/x-jide-session';

export interface PaneDropTargetProps {
  onDropSession: (sessionId: string) => void;
  children: ReactNode;
}

export function PaneDropTarget({ onDropSession, children }: PaneDropTargetProps): JSX.Element {
  const { accent } = useTheme();
  const [over, setOver] = useState(false);
  return (
    <div
      data-testid="pane-drop-target"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(SESSION_DRAG_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setOver(false);
      }}
      onDrop={(e) => {
        const uuid = e.dataTransfer.getData(SESSION_DRAG_MIME);
        setOver(false);
        if (uuid) onDropSession(uuid);
      }}
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
      {over && (
        <div
          aria-hidden
          data-testid="pane-drop-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            border: `2px dashed ${accent.value}`,
            background: accent.value + '14',
          }}
        />
      )}
    </div>
  );
}
