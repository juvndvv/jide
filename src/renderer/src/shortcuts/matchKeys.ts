export type KeyToken = string;

export interface ParsedKey {
  mods: { meta: boolean; shift: boolean; alt: boolean; ctrl: boolean };
  key: string;
}

const MOD_TOKENS = new Set(['meta', 'shift', 'alt', 'ctrl']);

function detectMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    '';
  if (/Mac|iPhone|iPad|iPod/i.test(platform)) return true;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent ?? '');
}

export function parseKeys(s: string): ParsedKey {
  const tokens = s
    .split('+')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  const mods = { meta: false, shift: false, alt: false, ctrl: false };
  let key = '';
  for (const token of tokens) {
    if (MOD_TOKENS.has(token)) {
      mods[token as keyof typeof mods] = true;
    } else {
      key = token;
    }
  }
  return { mods, key };
}

export function matchKey(parsed: ParsedKey, e: KeyboardEvent): boolean {
  const eventKey = e.key.toLowerCase();
  if (eventKey !== parsed.key) return false;

  // Cross-platform 'meta' resolves to ctrlKey on non-mac platforms.
  const isMac = detectMac();
  const expectMeta = parsed.mods.meta && isMac;
  const expectCtrl = parsed.mods.ctrl || (parsed.mods.meta && !isMac);

  if (e.metaKey !== expectMeta) return false;
  if (e.ctrlKey !== expectCtrl) return false;
  if (e.altKey !== parsed.mods.alt) return false;

  // For alphabetic single-letter keys shift is strict; for non-alpha printable keys
  // shift may be intrinsic to producing the character (e.g. '?' on US layout).
  const isAlpha = /^[a-z]$/.test(parsed.key);
  if (parsed.mods.shift) {
    if (!e.shiftKey) return false;
  } else if (isAlpha) {
    if (e.shiftKey) return false;
  }
  return true;
}
