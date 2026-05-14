import { useEffect, useRef, type JSX } from 'react';
import type { Message as Msg, SessionSnapshot } from '@shared/session';
import { useTheme } from '../../theme/useTheme';
import { useSession } from '../../shortcuts/useSession';
import { Message } from './Message';
import { Composer } from './Composer';
import { ApprovalBar } from './ApprovalBar';
import { StreamingIndicator } from './StreamingIndicator';
import { SessionMeta } from './SessionMeta';
import { PaneHeader } from './PaneHeader';
import { PaneDropTarget } from './PaneDropTarget';

export interface ChatPaneProps {
  worktreeId: string;
  leafId: string;
  sessionId: string | null;
  isActive: boolean;
  canSplit: boolean;
  canClose: boolean;
  onFocus: () => void;
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
  onClose: () => void;
  onAssignSession: (sessionId: string) => void;
}

export function ChatPane(props: ChatPaneProps): JSX.Element {
  const { worktreeId, sessionId } = props;
  const { theme } = useTheme();
  const { snapshot, send, approveTool, kill } = useSession(worktreeId, sessionId);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [snapshot?.messages.length, snapshot?.status]);

  return (
    <PaneDropTarget onDropSession={props.onAssignSession}>
      <PaneHeader
        title={paneTitle(snapshot)}
        status={snapshot?.status}
        canSplit={props.canSplit}
        canClose={props.canClose}
        isActive={props.isActive}
        onFocus={props.onFocus}
        onSplitHorizontal={props.onSplitHorizontal}
        onSplitVertical={props.onSplitVertical}
        onClose={props.onClose}
      />
      {!sessionId || !snapshot ? (
        <div
          data-testid="pane-empty"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.textLow,
            fontFamily: 'ui-monospace, monospace',
            fontSize: 12,
          }}
        >
          Arrastra una sesión aquí
        </div>
      ) : (
        <>
          <SessionMeta snapshot={snapshot} />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '2px 12px',
              fontSize: 11,
              color: theme.textMed,
              borderBottom: `1px solid ${theme.borderHair}`,
              background: theme.hoverBg,
              flexShrink: 0,
            }}
          >
            <span data-testid="chat-status">{snapshot.status}</span>
            <span style={{ flex: 1 }} />
            {isBusy(snapshot.status) && (
              <button
                type="button"
                data-testid="chat-kill"
                onClick={() => {
                  kill().catch((err: unknown) => {
                    console.error('[jide] sessions:kill failed', err);
                  });
                }}
                style={{
                  border: 'none',
                  background: theme.error,
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: 'inherit',
                }}
              >
                Stop
              </button>
            )}
          </div>
          <div
            ref={listRef}
            data-testid="pane-messages"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {snapshot.messages.map((m: Msg) => (
              <Message key={m.id} message={m} />
            ))}
            {isBusy(snapshot.status) && <StreamingIndicator />}
          </div>
          <ApprovalBar
            awaitingToolUseId={snapshot.awaitingToolUseId ?? null}
            toolName={findPendingTool(snapshot.messages, snapshot.awaitingToolUseId)?.name ?? null}
            onApprove={(id) => {
              approveTool(id, true).catch((err: unknown) => {
                console.error('[jide] sessions:approve-tool failed', err);
              });
            }}
            onReject={(id, reason) => {
              approveTool(id, false, reason).catch((err: unknown) => {
                console.error('[jide] sessions:approve-tool failed', err);
              });
            }}
          />
          <Composer
            onSubmit={(text) => {
              send(text).catch((err: unknown) => {
                console.error('[jide] sessions:send failed', err);
              });
            }}
            disabled={isBusy(snapshot.status)}
          />
        </>
      )}
    </PaneDropTarget>
  );
}

function paneTitle(snapshot: SessionSnapshot | null): string {
  if (!snapshot) return 'Sin sesión';
  return snapshot.title || 'Sesión';
}

function isBusy(status: string): boolean {
  return status === 'starting' || status === 'requesting' || status === 'streaming';
}

function findPendingTool(
  messages: Msg[],
  awaitingId: string | null | undefined,
): Extract<Msg, { type: 'tool' }> | null {
  if (!awaitingId) return null;
  for (const m of messages) {
    if (m.type === 'tool' && m.id === awaitingId) return m;
  }
  return null;
}
