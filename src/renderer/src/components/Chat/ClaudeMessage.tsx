import type { Message } from '@shared/session';
import { useTheme } from '../../theme/useTheme';

export function ClaudeMessage({ message }: { message: Extract<Message, { type: 'claude' }> }) {
  const { theme } = useTheme();
  const isThinking = message.thinking === true;
  return (
    <div
      data-testid={`message-claude-${message.id}`}
      style={{
        alignSelf: 'flex-start',
        maxWidth: '100%',
        color: isThinking ? theme.textMed : theme.text,
        fontSize: isThinking ? 12 : 13,
        fontStyle: isThinking ? 'italic' : 'normal',
        lineHeight: 1.5,
        marginBottom: 6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {message.text}
    </div>
  );
}
