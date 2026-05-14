import type { Message as Msg } from '@shared/session';
import { UserMessage } from './UserMessage';
import { ClaudeMessage } from './ClaudeMessage';
import { ToolMessage } from './ToolMessage';
import { DiffMessage } from './DiffMessage';
import { SystemMessage } from './SystemMessage';

export function Message({ message }: { message: Msg }) {
  switch (message.type) {
    case 'user':
      return <UserMessage message={message} />;
    case 'claude':
      return <ClaudeMessage message={message} />;
    case 'tool':
      return <ToolMessage message={message} />;
    case 'diff':
      return <DiffMessage message={message} />;
    case 'system':
      return <SystemMessage message={message} />;
  }
}
