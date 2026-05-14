const MAX_LEN = 32;
const ELLIPSIS = '…';

export function inferTitle(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= MAX_LEN) return normalized;
  return normalized.slice(0, MAX_LEN - ELLIPSIS.length) + ELLIPSIS;
}

export function defaultTitle(zeroBasedIndex: number): string {
  return `Sesión ${zeroBasedIndex + 1}`;
}
