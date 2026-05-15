import type { ShortcutContext, ShortcutId } from './ShortcutContext';

export type { ShortcutId };

export type WhenPredicate = (ctx: ShortcutContext) => boolean;

export type PaletteGroup = 'navigation' | 'actions' | 'layout' | 'sessions';
export type HelpGroup = 'Navegación' | 'Layout' | 'Sesiones' | 'Otros';

export interface KeyBinding {
  id: ShortcutId;
  keys: string;
  when: WhenPredicate;
  paletteLabel?: string;
  paletteHint?: string;
  paletteGroup?: PaletteGroup;
  helpGroup?: HelpGroup;
}

export const ALWAYS: WhenPredicate = () => true;
export const NOT_MODAL: WhenPredicate = (ctx) => !ctx.modalOpen;
export const ONLY_MODAL: WhenPredicate = (ctx) => ctx.modalOpen;
export const HELP_OK: WhenPredicate = (ctx) => !ctx.modalOpen && !ctx.inputFocused;

export const keymap: KeyBinding[] = [
  {
    id: 'palette.open',
    keys: 'meta+k',
    when: ALWAYS,
    paletteLabel: 'Abrir command palette',
    paletteGroup: 'navigation',
    helpGroup: 'Navegación',
  },
  {
    id: 'overlay.close',
    keys: 'escape',
    when: ONLY_MODAL,
    helpGroup: 'Navegación',
  },
  {
    id: 'worktree.new',
    keys: 'meta+n',
    when: NOT_MODAL,
    paletteLabel: 'Nuevo worktree…',
    paletteHint: 'Crea un worktree en el proyecto activo',
    paletteGroup: 'actions',
    helpGroup: 'Otros',
  },
  {
    id: 'tweaks.toggle',
    keys: 'meta+,',
    when: (ctx) => !ctx.modalOpen || ctx.topOverlayId === 'tweaks-panel',
    paletteLabel: 'Tweaks (theme, density, accent)',
    paletteGroup: 'layout',
    helpGroup: 'Layout',
  },
  {
    id: 'terminal.toggle',
    keys: 'meta+\\',
    when: NOT_MODAL,
    paletteLabel: 'Ciclar terminal',
    paletteHint: 'Off → bottom → side',
    paletteGroup: 'layout',
    helpGroup: 'Layout',
  },
  {
    id: 'viewer.toggle',
    keys: 'meta+o',
    when: NOT_MODAL,
    paletteLabel: 'Toggle visor de archivos',
    paletteGroup: 'layout',
    helpGroup: 'Layout',
  },
  {
    id: 'session.new',
    keys: 'meta+t',
    when: (ctx) => ctx.chatFocused && !ctx.sessionCapReached && !ctx.modalOpen,
    paletteLabel: 'Nueva sesión en worktree activo',
    paletteGroup: 'sessions',
    helpGroup: 'Sesiones',
  },
  {
    id: 'session.kill',
    keys: 'meta+shift+k',
    when: (ctx) => ctx.sessionActive && !ctx.modalOpen,
    paletteLabel: 'Matar sesión activa',
    paletteGroup: 'sessions',
    helpGroup: 'Sesiones',
  },
  {
    id: 'help.open',
    keys: '?',
    when: HELP_OK,
    paletteLabel: 'Mostrar atajos de teclado',
    paletteGroup: 'navigation',
    helpGroup: 'Navegación',
  },
];
