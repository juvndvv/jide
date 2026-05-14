import type { CSSProperties } from 'react';

type IconName =
  | 'branch'
  | 'chev-d'
  | 'chev-r'
  | 'command'
  | 'folder'
  | 'folder-open'
  | 'plus'
  | 'search'
  | 'settings'
  | 'x';

const PATHS: Record<IconName, string> = {
  branch:
    'M6 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm0 14a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm12-10a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM6 9v6m12-4a8 8 0 0 1-8 8',
  'chev-d': 'M6 9l6 6 6-6',
  'chev-r': 'M9 6l6 6-6 6',
  command: 'M9 3a3 3 0 1 1 3 3v12a3 3 0 1 1-3-3h6a3 3 0 1 1-3 3V6a3 3 0 1 1 3 3',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  'folder-open': 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2H5l-2 9V7Z',
  plus: 'M12 5v14M5 12h14',
  search:
    'M11 19a8 8 0 1 0-5.3-2L3 19.7 4.3 21l3-3A8 8 0 0 0 11 19Zm0-2a6 6 0 1 1 0-12 6 6 0 0 1 0 12Z',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3 1.4-1-1.6-2.8-1.7.7a7 7 0 0 0-1.2-.7L15.6 6h-3.2l-.3 2.2c-.4.2-.8.4-1.2.7l-1.7-.7L7.6 11l1.4 1c-.1.5-.1 1 0 1.6L7.6 14.6l1.6 2.8 1.7-.7c.4.3.8.5 1.2.7l.3 2.2h3.2l.3-2.2c.4-.2.8-.4 1.2-.7l1.7.7 1.6-2.8L19.4 13Z',
  x: 'M6 6l12 12M18 6 6 18',
};

const FILLED = new Set<IconName>(['search', 'folder', 'folder-open']);

export function JIcon({
  name,
  size = 16,
  color = 'currentColor',
  stroke = 1.6,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  stroke?: number;
  style?: CSSProperties;
}) {
  const d = PATHS[name];
  const filled = FILLED.has(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={filled ? 'none' : color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
    >
      <path d={d} />
    </svg>
  );
}
