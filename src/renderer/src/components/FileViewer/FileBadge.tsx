import type { JSX } from 'react';
import type { GitFileStatus } from '@shared/files';
import { useTheme } from '../../theme/useTheme';

export interface FileBadgeProps {
  status: GitFileStatus;
}

export function FileBadge({ status }: FileBadgeProps): JSX.Element | null {
  const { theme, accent } = useTheme();
  if (!status) return null;
  const color: string =
    status === '??' ? theme.warning
    : status === 'D' ? theme.error
    : status === 'M' ? accent.value
    : status === 'A' ? theme.success
    : theme.textLow;
  return (
    <span
      style={{
        color,
        fontSize: 10,
        marginLeft: 6,
        opacity: 0.9,
        minWidth: 14,
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {status}
    </span>
  );
}
