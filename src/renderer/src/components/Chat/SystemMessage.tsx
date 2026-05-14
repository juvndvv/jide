import type { Message } from '@shared/session';

const LEVEL_COLORS: Record<
  Extract<Message, { type: 'system' }>['level'],
  { bg: string; fg: string }
> = {
  info: { bg: '#F6F4EF', fg: '#00000080' },
  warn: { bg: '#FEF3C7', fg: '#92400E' },
  error: { bg: '#FFE5E5', fg: '#B40000' },
};

export function SystemMessage({ message }: { message: Extract<Message, { type: 'system' }> }) {
  const { bg, fg } = LEVEL_COLORS[message.level];
  return (
    <div
      data-testid={`message-system-${message.id}`}
      data-level={message.level}
      style={{
        alignSelf: 'stretch',
        background: bg,
        color: fg,
        border: '1px solid #00000010',
        borderRadius: 6,
        padding: '6px 10px',
        marginBottom: 6,
        fontSize: 12,
        whiteSpace: 'pre-wrap',
      }}
    >
      {message.text}
    </div>
  );
}
