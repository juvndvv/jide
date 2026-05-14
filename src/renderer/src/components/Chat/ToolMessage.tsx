import { useState } from 'react';
import type { Message } from '@shared/session';

const STATUS_COLORS: Record<Extract<Message, { type: 'tool' }>['status'], string> = {
  pending: '#F59E0B',
  approved: '#10B981',
  denied: '#ED5A46',
  running: '#3B82F6',
  done: '#10B981',
  error: '#ED5A46',
};

export function ToolMessage({ message }: { message: Extract<Message, { type: 'tool' }> }) {
  const outputLines = (message.output ?? '').split('\n').filter(Boolean);
  const isShort = outputLines.length < 5;
  const [expanded, setExpanded] = useState(isShort);
  const statusColor = STATUS_COLORS[message.status];
  const inputPreview = formatInput(message.input);

  return (
    <div
      data-testid={`message-tool-${message.id}`}
      style={{
        alignSelf: 'flex-start',
        width: '100%',
        background: '#F6F4EF',
        border: '1px solid #00000010',
        borderRadius: 8,
        padding: '8px 12px',
        marginBottom: 6,
        fontSize: 12,
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          background: 'transparent',
          border: 0,
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          textAlign: 'left',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          color: '#1F1F1F',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: 999,
            background: statusColor,
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600 }}>{message.name}</span>
        <span
          style={{
            color: '#00000060',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {inputPreview}
        </span>
        <span style={{ color: '#00000060', fontSize: 11 }}>{message.status}</span>
      </button>
      {expanded && message.output && (
        <pre
          data-testid={`message-tool-output-${message.id}`}
          style={{
            margin: '8px 0 0',
            padding: '8px 10px',
            background: '#1F1F1F',
            color: '#E5E7EB',
            borderRadius: 6,
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11,
            lineHeight: 1.5,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {message.output}
        </pre>
      )}
    </div>
  );
}

function formatInput(input: Record<string, unknown>): string {
  if (typeof input.command === 'string') return input.command;
  if (typeof input.file_path === 'string') return input.file_path;
  if (typeof input.path === 'string') return input.path;
  try {
    return JSON.stringify(input);
  } catch {
    return '[input]';
  }
}
