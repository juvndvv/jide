import { useState } from 'react';
import type { Message } from '@shared/session';
import { useTheme } from '../../theme/useTheme';
import { useOpenFile } from './OpenFileContext';

export function ToolMessage({ message }: { message: Extract<Message, { type: 'tool' }> }) {
  const { theme } = useTheme();
  const openFile = useOpenFile();
  const outputLines = (message.output ?? '').split('\n').filter(Boolean);
  const isShort = outputLines.length < 5;
  const [expanded, setExpanded] = useState(isShort);

  const statusColor =
    message.status === 'running'
      ? theme.info
      : message.status === 'approved' || message.status === 'done'
        ? theme.success
        : message.status === 'denied' || message.status === 'error'
          ? theme.error
          : theme.warning;

  const inputPreview = formatInput(message.input);
  const filePath = extractFilePath(message.input);
  const canOpenFile = filePath !== null && openFile !== null;

  return (
    <div
      data-testid={`message-tool-${message.id}`}
      style={{
        alignSelf: 'flex-start',
        width: '100%',
        background: theme.panelMuted,
        border: `1px solid ${theme.borderHair}`,
        borderRadius: 8,
        padding: '8px 12px',
        marginBottom: 6,
        fontSize: 12,
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            flex: 1,
            minWidth: 0,
            textAlign: 'left',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            color: theme.text,
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
              color: theme.textMed,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {inputPreview}
          </span>
          <span style={{ color: theme.textMed, fontSize: 11 }}>{message.status}</span>
        </button>
        {canOpenFile && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (filePath) openFile(filePath);
            }}
            aria-label={`Abrir ${filePath} en el visor`}
            data-testid={`message-tool-open-${message.id}`}
            style={{
              background: 'transparent',
              border: `1px solid ${theme.borderHair}`,
              borderRadius: 4,
              color: theme.textMed,
              cursor: 'pointer',
              fontSize: 11,
              padding: '2px 6px',
              flexShrink: 0,
            }}
          >
            Abrir
          </button>
        )}
      </div>
      {expanded && message.output && (
        <pre
          data-testid={`message-tool-output-${message.id}`}
          style={{
            margin: '8px 0 0',
            padding: '8px 10px',
            background: theme.text,
            color: theme.panelMuted,
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

function extractFilePath(input: Record<string, unknown>): string | null {
  if (typeof input.file_path === 'string') return input.file_path;
  if (typeof input.path === 'string') return input.path;
  return null;
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
