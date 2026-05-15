import { useMemo } from 'react';
import type { JSX } from 'react';
import { Overlay } from '../../overlay/Overlay';
import { useTheme } from '../../theme/useTheme';
import { keymap, type KeyBinding } from '../../shortcuts/keymap';
import { Kbd } from '../icons/Kbd';

interface HelpDialogProps {
  onClose: () => void;
}

export function HelpDialog({ onClose }: HelpDialogProps): JSX.Element {
  const { theme } = useTheme();
  const groups = useMemo(() => {
    const byGroup = new Map<string, KeyBinding[]>();
    for (const b of keymap) {
      if (b.helpGroup === undefined) continue;
      const arr = byGroup.get(b.helpGroup) ?? [];
      arr.push(b);
      byGroup.set(b.helpGroup, arr);
    }
    return Array.from(byGroup.entries());
  }, []);
  return (
    <Overlay
      id="help"
      z={120}
      onClose={onClose}
      ariaLabel="Atajos de teclado"
      dataTestId="help-dialog"
    >
      <div
        style={{
          width: 540,
          maxHeight: '80vh',
          overflow: 'auto',
          padding: 20,
          background: theme.panelBg,
          borderRadius: 10,
          boxShadow: theme.modalShadow,
          color: theme.text,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, marginBottom: 12 }}>Atajos de teclado</h2>
        {groups.map(([heading, items]) => (
          <section key={heading} style={{ marginBottom: 16 }}>
            <h3
              style={{
                margin: '0 0 8px 0',
                fontSize: 13,
                color: theme.textMed,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {heading}
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id}>
                    <td style={{ padding: '4px 0', width: 140 }}>
                      <Kbd>{b.keys}</Kbd>
                    </td>
                    <td style={{ padding: '4px 0' }}>{b.paletteLabel ?? b.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </Overlay>
  );
}
