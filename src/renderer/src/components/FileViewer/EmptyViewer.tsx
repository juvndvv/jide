import type { JSX } from 'react';
import { useTheme } from '../../theme/useTheme';

export function EmptyViewer(): JSX.Element {
  const { theme } = useTheme();
  return (
    <div style={{ padding: 24, color: theme.textMed, fontSize: 12, textAlign: 'center' }}>
      Selecciona un archivo del árbol o cierra el visor con ⌘O.
    </div>
  );
}
