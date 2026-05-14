import { useEffect } from 'react';

export interface GlobalShortcutHandlers {
  onToggleTweaks?: () => void;
  onNewWorktree?: () => void;
  onEscape?: () => void;
}

export function useGlobalShortcuts(handlers: GlobalShortcutHandlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === ',') {
        e.preventDefault();
        handlers.onToggleTweaks?.();
        return;
      }
      if (mod && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        handlers.onNewWorktree?.();
        return;
      }
      if (e.key === 'Escape') {
        handlers.onEscape?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers]);
}
