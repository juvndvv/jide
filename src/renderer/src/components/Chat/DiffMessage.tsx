import type { Message } from '@shared/session';

export function DiffMessage({ message }: { message: Extract<Message, { type: 'diff' }> }) {
  return (
    <div
      data-testid={`message-diff-${message.id}`}
      style={{
        alignSelf: 'flex-start',
        width: '100%',
        background: '#F6F4EF',
        border: '1px solid #00000010',
        borderRadius: 8,
        padding: '8px 12px',
        marginBottom: 6,
        fontFamily: 'ui-monospace, monospace',
        fontSize: 11,
      }}
    >
      <div style={{ fontWeight: 600, color: '#1F1F1F', marginBottom: 4 }}>{message.file}</div>
      <pre style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre' }}>
        {message.lines.map((line, i) => (
          <div
            key={i}
            style={{
              color: line.sign === '+' ? '#10B981' : line.sign === '-' ? '#ED5A46' : '#00000080',
            }}
          >
            {line.sign} {line.text}
          </div>
        ))}
      </pre>
    </div>
  );
}
