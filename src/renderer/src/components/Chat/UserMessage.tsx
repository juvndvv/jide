import type { Message } from '@shared/session';

export function UserMessage({ message }: { message: Extract<Message, { type: 'user' }> }) {
  return (
    <div
      data-testid={`message-user-${message.id}`}
      style={{
        alignSelf: 'flex-end',
        maxWidth: '80%',
        background: '#F95A5C',
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
