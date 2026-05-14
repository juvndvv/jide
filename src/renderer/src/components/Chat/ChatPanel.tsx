import { useEffect, useRef } from 'react';
import type { Message as Msg } from '@shared/session';
import { Message } from './Message';
import { Composer } from './Composer';
import { ApprovalBar } from './ApprovalBar';
import { StreamingIndicator } from './StreamingIndicator';
import { SessionStrip } from './SessionStrip';
import { SessionMeta } from './SessionMeta';
import { EmptySessions } from './EmptySessions';
import { useSession } from '../../shortcuts/useSession';
import { useSessionsList } from '../../shortcuts/useSessionsList';
import { useSessionHotkey } from './useSessionHotkey';

const DEFAULT_MAX_SESSIONS = 4;

export interface ChatPanelProps {
  worktreeId: string | null;
  maxSessionsPerWorktree?: number;
}

export function ChatPanel({
  worktreeId,
  maxSessionsPerWorktree = DEFAULT_MAX_SESSIONS,
}: ChatPanelProps) {
  const { sessions, activeId, setActive, create, rename, kill: killSession, capReached } =
    useSessionsList(worktreeId, maxSessionsPerWorktree);
  const { snapshot, send, approveTool, kill: killActive } = useSession(worktreeId, activeId);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [snapshot?.messages.length, snapshot?.status]);

  useSessionHotkey(worktreeId !== null && !capReached, () => {
    void create();
  });

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

  return (
    <main
      data-testid="chat-panel"
      data-status={snapshot?.status ?? 'idle'}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      <SessionStrip
        sessions={sessions}
        activeId={activeId}
        capReached={capReached}
        onSelect={(id) => {
          void setActive(id);
        }}
        onRename={(id, title) => {
          void rename(id, title);
        }}
        onClose={(id) => {
          void killSession(id);
        }}
        onNew={() => {
          void create();
        }}
      />

      {sessions.length === 0 || !snapshot ? (
        <EmptySessions
          onCreate={() => {
            void create();
          }}
          disabled={capReached}
        />
      ) : (
        <>
          <SessionMeta snapshot={snapshot} />
          <ChatBody
            messages={snapshot.messages}
            status={snapshot.status}
            onKill={() => {
              killActive().catch((err: unknown) => {
                console.error('[jide] sessions:kill failed', err);
              });
            }}
            listRef={listRef}
          />
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
            disabled={!activeId || isBusy(snapshot.status)}
          />
        </>
      )}
    </main>
  );
}

function ChatBody({
  messages,
  status,
  onKill,
  listRef,
}: {
  messages: Msg[];
  status: string;
  onKill: () => void;
  listRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  return (
    <>
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
        <span style={{ flex: 1 }} />
        {isBusy(status) && (
          <button
            type="button"
            data-testid="chat-kill"
            onClick={onKill}
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
        {isBusy(status) && <StreamingIndicator />}
      </div>
    </>
  );
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
