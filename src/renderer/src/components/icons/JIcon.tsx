import type { CSSProperties, ReactNode } from 'react';

type IconName =
  | 'arrow-down'
  | 'arrow-up'
  | 'branch'
  | 'chev-d'
  | 'chev-r'
  | 'claude'
  | 'cli'
  | 'command'
  | 'diff'
  | 'folder'
  | 'folder-open'
  | 'plus'
  | 'search'
  | 'settings'
  | 'x';

const SHAPES: Record<IconName, ReactNode> = {
  'arrow-down': <path d="M12 5v14M5 12l7 7 7-7" />,
  'arrow-up': <path d="M12 19V5M5 12l7-7 7 7" />,
  branch:
    'M6 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm0 14a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm12-10a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM6 9v6m12-4a8 8 0 0 1-8 8',
  'chev-d': 'M6 9l6 6 6-6',
  'chev-r': 'M9 6l6 6-6 6',
  claude: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 9c0 5 4 7 8 7M16 9c0 5-4 7-8 7" />
    </>
  ),
  cli: <path d="m4 7 5 5-5 5M12 17h8" />,
  command: 'M9 3a3 3 0 1 1 3 3v12a3 3 0 1 1-3-3h6a3 3 0 1 1-3 3V6a3 3 0 1 1 3 3',
  diff: (
    <>
      <path d="M11 4v6h6M13 20v-6H7" />
      <path d="m7 10 4-6M17 14l-4 6" />
    </>
  ),
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

function resolveChildren(name: IconName, color: string): ReactNode {
  const shape = SHAPES[name];
  if (typeof shape === 'string') {
    const filled = FILLED.has(name);
    return <path d={shape} fill={filled ? color : 'none'} />;
  }
  return shape;
}

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
  const filled = typeof SHAPES[name] === 'string' && FILLED.has(name);
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
      {resolveChildren(name, color)}
    </svg>
  );
}
