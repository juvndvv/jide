import { useEffect } from 'react';

export function useSessionHotkey(enabled: boolean, onNew: () => void): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent): void => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      if (e.key !== 't' && e.key !== 'T') return;
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'INPUT') return;
      e.preventDefault();
      onNew();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, onNew]);
}
