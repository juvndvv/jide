import { useState, useRef, useEffect } from 'react';
import type { SessionSnapshot } from '@shared/session';
import { useTheme } from '../../theme/useTheme';
import { SESSION_DRAG_MIME } from './PaneDropTarget';

export interface SessionChipProps {
  snapshot: SessionSnapshot;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onClose: () => void;
}

export function SessionChip({ snapshot, active, onSelect, onRename, onClose }: SessionChipProps) {
  const { theme, accent } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(snapshot.title);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setDraft(snapshot.title);
  }, [snapshot.title]);

  const commit = (): void => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== snapshot.title) onRename(trimmed);
    setEditing(false);
  };

  const cancel = (): void => {
    setDraft(snapshot.title);
    setEditing(false);
  };

  const isRunning =
    snapshot.status === 'starting' ||
    snapshot.status === 'requesting' ||
    snapshot.status === 'streaming';

  const statusColor = isRunning
    ? accent.value
    : snapshot.status === 'awaiting'
      ? theme.warning
      : snapshot.status === 'error'
        ? theme.error
        : theme.textDisabled;

  return (
    <div
      data-testid={`session-chip-${snapshot.id.uuid}`}
      data-active={active}
      role="tab"
      aria-selected={active}
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData(SESSION_DRAG_MIME, snapshot.id.uuid);
        e.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onClick={editing ? undefined : onSelect}
      onDoubleClick={() => setEditing(true)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: active ? accent.value + '1F' : theme.hoverBg,
        color: active ? theme.text : theme.textMed,
        fontSize: 12,
        cursor: editing ? 'text' : dragging ? 'grabbing' : 'grab',
        flexShrink: 0,
        userSelect: 'none',
        opacity: dragging ? 0.5 : 1,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: 999,
          background: statusColor,
          animation: isRunning ? 'jidePulse 1.6s ease-out infinite' : 'none',
        }}
      />
      {editing ? (
        <input
          ref={inputRef}
          draggable={false}
          data-testid={`session-chip-rename-${snapshot.id.uuid}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') cancel();
            e.stopPropagation();
          }}
          maxLength={32}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
            width: Math.max(40, draft.length * 7),
          }}
        />
      ) : (
        <span>{snapshot.title || 'Sin título'}</span>
      )}
      {!editing && active && (
        <button
          type="button"
          draggable={false}
          data-testid={`session-chip-close-${snapshot.id.uuid}`}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Cerrar sesión"
          style={{
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            padding: 0,
            opacity: 0.7,
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
