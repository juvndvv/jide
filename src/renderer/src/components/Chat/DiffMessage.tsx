import type { Message } from '@shared/session';
import { useTheme } from '../../theme/useTheme';

export function DiffMessage({ message }: { message: Extract<Message, { type: 'diff' }> }) {
  const { theme } = useTheme();
  return (
    <div
      data-testid={`message-diff-${message.id}`}
      style={{
        alignSelf: 'flex-start',
        width: '100%',
        background: theme.panelMuted,
        border: `1px solid ${theme.borderHair}`,
        borderRadius: 8,
        padding: '8px 12px',
        marginBottom: 6,
        fontFamily: 'ui-monospace, monospace',
        fontSize: 11,
      }}
    >
      <div style={{ fontWeight: 600, color: theme.text, marginBottom: 4 }}>{message.file}</div>
      <pre style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre' }}>
        {message.lines.map((line, i) => (
          <div
            key={i}
            style={{
              color:
                line.sign === '+'
                  ? theme.diffAddText
                  : line.sign === '-'
                    ? theme.diffDelText
                    : theme.textMed,
            }}
          >
            {line.sign} {line.text}
          </div>
        ))}
      </pre>
    </div>
  );
}
