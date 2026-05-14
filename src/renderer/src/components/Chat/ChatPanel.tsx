import { useEffect, useRef } from 'react';
import type { Message as Msg } from '@shared/session';
import { Message } from './Message';
import { Composer } from './Composer';
import { ApprovalBar } from './ApprovalBar';
import { StreamingIndicator } from './StreamingIndicator';
import { useSession } from '../../shortcuts/useSession';

export interface ChatPanelProps {
  worktreeId: string | null;
}

export function ChatPanel({ worktreeId }: ChatPanelProps) {
  const { snapshot, send, approveTool, kill } = useSession(worktreeId);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Autoscroll to bottom on every message change so the latest turn stays visible.
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [snapshot?.messages.length, snapshot?.status]);

  if (!worktreeId) {
    return (
      <main
        data-testid="chat-panel-empty"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#00000040',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 14,
        }}
      >
        Selecciona un worktree
      </main>
    );
  }

  const status = snapshot?.status ?? 'idle';
  const isBusy = status === 'starting' || status === 'requesting' || status === 'streaming';
  const messages = snapshot?.messages ?? [];
  const pendingTool = findPendingTool(messages, snapshot?.awaitingToolUseId);

  return (
    <main
      data-testid="chat-panel"
      data-status={status}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #00000010',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: '#00000080',
        }}
      >
        <span data-testid="chat-status">{status}</span>
        {snapshot?.model && (
          <span style={{ fontFamily: 'ui-monospace, monospace' }}>{snapshot.model}</span>
        )}
        {snapshot?.totalCostUsd !== undefined && snapshot.totalCostUsd > 0 && (
          <span style={{ fontFamily: 'ui-monospace, monospace' }}>
            ${snapshot.totalCostUsd.toFixed(4)}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {snapshot && isBusy && (
          <button
            type="button"
            data-testid="chat-kill"
            onClick={() => {
              kill().catch((err: unknown) => {
                console.error('[jide] sessions:kill failed', err);
              });
            }}
            style={{
              padding: '4px 10px',
              border: '1px solid #ED5A46',
              background: '#FFFFFF',
              color: '#ED5A46',
              borderRadius: 6,
              fontFamily: 'inherit',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Kill
          </button>
        )}
      </header>

      <div
        ref={listRef}
        data-testid="chat-messages"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}
        {isBusy && <StreamingIndicator />}
      </div>

      <ApprovalBar
        awaitingToolUseId={snapshot?.awaitingToolUseId ?? null}
        toolName={pendingTool?.name ?? null}
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
        disabled={!worktreeId || isBusy}
      />
    </main>
  );
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
