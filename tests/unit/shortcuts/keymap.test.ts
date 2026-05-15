import { describe, it, expect } from 'vitest';
import { keymap } from '@renderer/shortcuts/keymap';
import type { ShortcutContext } from '@renderer/shortcuts/ShortcutContext';

const CONTEXTS: Array<{ name: string; ctx: ShortcutContext }> = [
  {
    name: 'empty',
    ctx: {
      modalOpen: false,
      inputFocused: false,
      chatFocused: false,
      sessionActive: false,
      sessionCapReached: false,
    },
  },
  {
    name: 'modal-open',
    ctx: {
      modalOpen: true,
      inputFocused: false,
      chatFocused: false,
      sessionActive: false,
      sessionCapReached: false,
    },
  },
  {
    name: 'input-focused',
    ctx: {
      modalOpen: false,
      inputFocused: true,
      chatFocused: false,
      sessionActive: false,
      sessionCapReached: false,
    },
  },
  {
    name: 'chat-focused-session-active',
    ctx: {
      modalOpen: false,
      inputFocused: false,
      chatFocused: true,
      sessionActive: true,
      sessionCapReached: false,
    },
  },
];

describe('keymap', () => {
  it('has unique ids', () => {
    const ids = keymap.map((k) => k.id);
    expect(new Set(ids).size).toBe(keymap.length);
  });

  it('keeps paletteLabel and paletteGroup consistent', () => {
    for (const binding of keymap) {
      const hasLabel = binding.paletteLabel !== undefined;
      const hasGroup = binding.paletteGroup !== undefined;
      expect(hasLabel).toBe(hasGroup);
    }
  });

  it('has no key collisions whose when-predicates can both be true in any standard context', () => {
    for (let i = 0; i < keymap.length; i++) {
      for (let j = i + 1; j < keymap.length; j++) {
        const a = keymap[i]!;
        const b = keymap[j]!;
        if (a.keys !== b.keys) continue;
        const mutuallyExclusive = CONTEXTS.some(({ ctx }) => {
          const aActive = a.when(ctx);
          const bActive = b.when(ctx);
          return aActive !== bActive;
        });
        expect(
          mutuallyExclusive,
          `${a.id} and ${b.id} share keys "${a.keys}" without mutual exclusion`,
        ).toBe(true);
      }
    }
  });

  it('declares all expected shortcut ids', () => {
    const ids = new Set(keymap.map((k) => k.id));
    expect(ids).toContain('palette.open');
    expect(ids).toContain('help.open');
    expect(ids).toContain('overlay.close');
    expect(ids).toContain('worktree.new');
    expect(ids).toContain('tweaks.toggle');
    expect(ids).toContain('terminal.toggle');
    expect(ids).toContain('viewer.toggle');
    expect(ids).toContain('session.new');
    expect(ids).toContain('session.kill');
  });

  it('uses Spanish labels for palette entries', () => {
    const paletteOpen = keymap.find((k) => k.id === 'palette.open');
    expect(paletteOpen?.paletteLabel).toBe('Abrir command palette');
    const terminalToggle = keymap.find((k) => k.id === 'terminal.toggle');
    expect(terminalToggle?.paletteHint).toBe('Off → bottom → side');
  });
});
