import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isVisible(el: HTMLElement): boolean {
  // jsdom always reports offsetParent === null. In real DOMs, hidden elements
  // (display:none / visibility:hidden / detached) also yield null. We additionally
  // check that the element is connected and not aria-hidden/style-hidden as a
  // pragmatic fallback for tests.
  if (!el.isConnected) return false;
  if (el.hasAttribute('hidden')) return false;
  const style = el.style;
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return true;
}

function getFocusables(root: HTMLElement): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  const out: HTMLElement[] = [];
  for (const n of nodes) if (isVisible(n)) out.push(n);
  return out;
}

export function useFocusTrap(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = getFocusables(root);
    const first = focusables[0];
    if (first) {
      first.focus();
    } else {
      // Make the root itself focusable as a last resort so Tab handling still works.
      if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
      root.focus();
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      const items = getFocusables(root);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (!firstItem || !lastItem) return;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === firstItem || !root.contains(active)) {
          e.preventDefault();
          lastItem.focus();
        }
      } else {
        if (active === lastItem || !root.contains(active)) {
          e.preventDefault();
          firstItem.focus();
        }
      }
    };

    root.addEventListener('keydown', onKeyDown);

    return () => {
      root.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [rootRef]);
}
