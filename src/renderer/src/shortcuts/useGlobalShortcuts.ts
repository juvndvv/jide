import { useEffect, useRef } from 'react';
import { keymap, type KeyBinding } from './keymap';
import { parseKeys, matchKey, type ParsedKey } from './matchKeys';
import { useShortcutContext, useShortcutDispatcher } from './ShortcutContext';

const parsed: Array<[ParsedKey, KeyBinding]> = keymap.map((b) => [parseKeys(b.keys), b]);

export function useGlobalShortcuts(): void {
  const ctx = useShortcutContext();
  const dispatcher = useShortcutDispatcher();
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const dispatcherRef = useRef(dispatcher);
  dispatcherRef.current = dispatcher;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      for (const [p, binding] of parsed) {
        if (!binding.when(ctxRef.current)) continue;
        if (!matchKey(p, e)) continue;
        e.preventDefault();
        dispatcherRef.current.dispatch(binding.id);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
