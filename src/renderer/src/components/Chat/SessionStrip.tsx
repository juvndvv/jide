import type { SessionSnapshot } from '@shared/session';
import { SessionChip } from './SessionChip';
import { useTheme } from '../../theme/useTheme';

export interface SessionStripProps {
  sessions: SessionSnapshot[];
  activeId: string | null;
  capReached: boolean;
  onSelect: (sessionId: string) => void;
  onRename: (sessionId: string, title: string) => void;
  onClose: (sessionId: string) => void;
  onNew: () => void;
}

export function SessionStrip({
  sessions,
  activeId,
  capReached,
  onSelect,
  onRename,
  onClose,
  onNew,
}: SessionStripProps) {
  const { theme } = useTheme();
  return (
    <div
      data-testid="session-strip"
      role="tablist"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderBottom: `1px solid ${theme.borderHair}`,
        overflowX: 'auto',
        whiteSpace: 'nowrap',
      }}
    >
      {sessions.map((s) => (
        <SessionChip
          key={s.id.uuid}
          snapshot={s}
          active={s.id.uuid === activeId}
          onSelect={() => onSelect(s.id.uuid)}
          onRename={(title) => onRename(s.id.uuid, title)}
          onClose={() => onClose(s.id.uuid)}
        />
      ))}
      <button
        type="button"
        data-testid="session-strip-new"
        disabled={capReached}
        onClick={onNew}
        aria-label="Nueva sesión (⌘T)"
        title={capReached ? 'Cap alcanzado' : 'Nueva sesión (⌘T)'}
        style={{
          marginLeft: 4,
          padding: '4px 10px',
          borderRadius: 999,
          border: `1px dashed ${theme.border}`,
          background: 'transparent',
          color: capReached ? theme.textDisabled : theme.textMed,
          cursor: capReached ? 'not-allowed' : 'pointer',
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        + Nueva
      </button>
    </div>
  );
}
