import { useState } from 'react';
import type { JSX } from 'react';
import type { SessionSnapshot } from '@shared/session';
import { useTheme } from '../../theme/useTheme';
import { Overlay } from '../../overlay/Overlay';

interface KillConfirmDialogProps {
  worktreeId: string;
  session: SessionSnapshot;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function KillConfirmDialog({
  worktreeId,
  session,
  onCancel,
  onConfirm,
}: KillConfirmDialogProps): JSX.Element {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);

  const handle = async (): Promise<void> => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  const fallbackTitle = `Sesión ${session.id.uuid.slice(0, 6)}`;
  const displayTitle = session.title ? session.title : fallbackTitle;

  return (
    <Overlay
      id="kill-confirm"
      z={100}
      onClose={busy ? () => {} : onCancel}
      ariaLabel="Confirmar matar sesión"
      dataTestId="kill-confirm-dialog"
    >
      <div
        data-worktree-id={worktreeId}
        style={{
          width: 420,
          padding: 20,
          background: theme.panelBg,
          borderRadius: 10,
          boxShadow: theme.modalShadow,
          fontFamily: 'inherit',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, marginBottom: 8 }}>Matar sesión</h2>
        <p style={{ margin: '0 0 12px 0', color: theme.textMed }}>
          Vas a matar <strong>{displayTitle}</strong>
          {session.model ? <> · {session.model}</> : null}.
        </p>
        <p style={{ margin: '0 0 16px 0', color: theme.textMed, fontSize: 12 }}>
          El proceso terminará inmediatamente. La conversación se mantiene en el historial.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            data-testid="kill-confirm-submit"
            onClick={() => void handle()}
            disabled={busy}
            autoFocus
            style={{
              background: theme.error,
              color: '#FFFFFF',
              border: 'none',
              padding: '6px 12px',
              borderRadius: 6,
            }}
          >
            {busy ? 'Matando…' : 'Matar'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
