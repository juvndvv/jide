import type { JSX } from 'react';
import { useTheme } from '../../theme/useTheme';

export interface TooLargePlaceholderProps {
  sizeBytes: number;
}

function formatSize(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function TooLargePlaceholder({ sizeBytes }: TooLargePlaceholderProps): JSX.Element {
  const { theme } = useTheme();
  return (
    <div style={{ padding: 24, color: theme.textMed, fontSize: 12, textAlign: 'center' }}>
      <div>Archivo demasiado grande ({formatSize(sizeBytes)}) — vista deshabilitada.</div>
    </div>
  );
}
