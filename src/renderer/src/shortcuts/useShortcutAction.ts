import { useEffect } from 'react';
import { useShortcutDispatcher } from './ShortcutContext';
import type { ShortcutId } from './ShortcutContext';

export function useShortcutAction(id: ShortcutId, handler: () => void, enabled = true): void {
  const dispatcher = useShortcutDispatcher();
  useEffect(() => {
    if (!enabled) return;
    return dispatcher.register(id, handler);
  }, [dispatcher, id, handler, enabled]);
}
