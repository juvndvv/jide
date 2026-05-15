import { useEffect } from 'react';
import { keymap, type KeyBinding } from './keymap';
import { parseKeys, matchKey, type ParsedKey } from './matchKeys';
import { useShortcutContext, useShortcutDispatcher } from './ShortcutContext';
import { useShortcutAction } from './useShortcutAction';

const parsed: Array<[ParsedKey, KeyBinding]> = keymap.map((b) => [parseKeys(b.keys), b]);

export function useGlobalShortcuts(): void {
  const ctx = useShortcutContext();
  const dispatcher = useShortcutDispatcher();
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      for (const [p, binding] of parsed) {
        if (!binding.when(ctx)) continue;
        if (!matchKey(p, e)) continue;
        e.preventDefault();
        dispatcher.dispatch(binding.id);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ctx, dispatcher]);
}

export interface GlobalShortcutHandlers {
  onToggleTweaks?: () => void;
  onNewWorktree?: () => void;
  onEscape?: () => void;
  onToggleTerminal?: () => void;
  onToggleViewer?: () => void;
}

export function useLegacyGlobalShortcuts(handlers: GlobalShortcutHandlers): void {
  const noop = (): void => {};
  useShortcutAction(
    'tweaks.toggle',
    handlers.onToggleTweaks ?? noop,
    handlers.onToggleTweaks !== undefined,
  );
  useShortcutAction(
    'worktree.new',
    handlers.onNewWorktree ?? noop,
    handlers.onNewWorktree !== undefined,
  );
  useShortcutAction(
    'terminal.toggle',
    handlers.onToggleTerminal ?? noop,
    handlers.onToggleTerminal !== undefined,
  );
  useShortcutAction(
    'viewer.toggle',
    handlers.onToggleViewer ?? noop,
    handlers.onToggleViewer !== undefined,
  );
  useShortcutAction('overlay.close', handlers.onEscape ?? noop, handlers.onEscape !== undefined);
}
