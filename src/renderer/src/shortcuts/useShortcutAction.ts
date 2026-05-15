import { useEffect, useRef } from 'react';
import { useShortcutDispatcher } from './ShortcutContext';
import type { ShortcutId } from './ShortcutContext';

export function useShortcutAction(id: ShortcutId, handler: () => void, enabled = true): void {
  const dispatcher = useShortcutDispatcher();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!enabled) return;
    return dispatcher.register(id, () => handlerRef.current());
  }, [dispatcher, id, enabled]);
}
