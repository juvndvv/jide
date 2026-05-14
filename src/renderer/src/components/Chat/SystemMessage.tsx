import type { Message } from '@shared/session';
import { useTheme } from '../../theme/useTheme';

export function SystemMessage({ message }: { message: Extract<Message, { type: 'system' }> }) {
  const { theme } = useTheme();

  const colors: Record<Extract<Message, { type: 'system' }>['level'], { bg: string; fg: string }> =
    {
      info: { bg: theme.panelMuted, fg: theme.textMed },
      warn: { bg: theme.warning + '1F', fg: theme.warning },
      error: { bg: theme.error + '1F', fg: theme.error },
    };

  const { bg, fg } = colors[message.level];
  return (
    <div
      data-testid={`message-system-${message.id}`}
      data-level={message.level}
      style={{
        alignSelf: 'stretch',
        background: bg,
        color: fg,
        border: `1px solid ${theme.borderHair}`,
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
