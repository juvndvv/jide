import type { JSX } from 'react';
import { useTheme } from '../../theme/useTheme';

export interface BinaryFilePlaceholderProps {
  ext: string;
  sizeBytes: number;
}

function formatSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function BinaryFilePlaceholder({ ext, sizeBytes }: BinaryFilePlaceholderProps): JSX.Element {
  const { theme } = useTheme();
  return (
    <div style={{ padding: 24, color: theme.textMed, fontSize: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
      <div>Archivo binario ({ext || 'sin extensión'}) — {formatSize(sizeBytes)}</div>
      <div style={{ marginTop: 4 }}>No se puede previsualizar.</div>
    </div>
  );
}
