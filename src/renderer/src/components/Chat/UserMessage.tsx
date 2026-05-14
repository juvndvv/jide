import type { Message } from '@shared/session';
import { useTheme } from '../../theme/useTheme';

export function UserMessage({ message }: { message: Extract<Message, { type: 'user' }> }) {
  const { accent } = useTheme();
  return (
    <div
      data-testid={`message-user-${message.id}`}
      style={{
        alignSelf: 'flex-end',
        maxWidth: '80%',
        background: accent.value,
        color: '#FFFFFF',
        borderRadius: 12,
        padding: '8px 12px',
        marginBottom: 6,
        fontSize: 13,
        lineHeight: 1.45,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {message.text}
    </div>
  );
}
