import type { Message } from '@shared/session';

export function ClaudeMessage({ message }: { message: Extract<Message, { type: 'claude' }> }) {
  const isThinking = message.thinking === true;
  return (
    <div
      data-testid={`message-claude-${message.id}`}
      style={{
        alignSelf: 'flex-start',
        maxWidth: '100%',
        color: isThinking ? '#00000060' : '#1F1F1F',
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
