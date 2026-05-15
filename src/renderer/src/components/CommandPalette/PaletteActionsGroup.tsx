import { Command } from 'cmdk';
import type { JSX } from 'react';
import { keymap } from '../../shortcuts/keymap';
import { useShortcutContext, useShortcutDispatcher } from '../../shortcuts/ShortcutContext';
import { Kbd } from '../icons/Kbd';

interface Props {
  onSelect: () => void;
}

export function PaletteActionsGroup({ onSelect }: Props): JSX.Element | null {
  const ctx = useShortcutContext();
  const dispatcher = useShortcutDispatcher();
  const paletteCtx = { ...ctx, modalOpen: false, topOverlayId: null };
  const items = keymap.filter(
    (b) => b.paletteLabel !== undefined && b.id !== 'palette.open' && b.when(paletteCtx),
  );
  if (items.length === 0) return null;
  return (
    <Command.Group heading="Acciones">
      {items.map((b) => (
        <Command.Item
          key={b.id}
          value={b.paletteLabel ?? b.id}
          keywords={[b.id, b.paletteHint ?? '', b.paletteGroup ?? '']}
          onSelect={() => {
            onSelect();
            dispatcher.dispatch(b.id);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 10px',
            borderRadius: 6,
            cursor: 'pointer',
            gap: 8,
          }}
        >
          <span>{b.paletteLabel}</span>
          {b.paletteHint !== undefined && b.paletteHint !== '' ? (
            <span style={{ marginLeft: 8, opacity: 0.7 }}>{b.paletteHint}</span>
          ) : null}
          <span style={{ marginLeft: 'auto' }}>
            <Kbd>{b.keys}</Kbd>
          </span>
        </Command.Item>
      ))}
    </Command.Group>
  );
}
