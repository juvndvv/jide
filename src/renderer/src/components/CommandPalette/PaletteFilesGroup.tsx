import { Command } from 'cmdk';
import { useEffect, useState, type JSX } from 'react';
import { useTheme } from '../../theme/useTheme';

interface Props {
  worktreeId: string | null;
  query: string;
  onOpen: (relPath: string) => void;
  onSelect: () => void;
}

// v1: always route file queries through the lazy IPC search instead of
// eagerly flattening the renderer-side watcher tree. The watcher tree only
// holds children for directories the user has expanded, so an eager scan
// would miss most files. A future Fase 9 task may add `files:listAll` to
// enable an eager path with a hard cap (~5000 entries).
const LAZY_LIMIT = 100;
const LAZY_DEBOUNCE_MS = 150;
const MIN_QUERY_LEN = 2;

function dirname(relPath: string): string {
  const i = relPath.lastIndexOf('/');
  return i === -1 ? '' : relPath.slice(0, i);
}

export function PaletteFilesGroup({ worktreeId, query, onOpen, onSelect }: Props): JSX.Element | null {
  const { theme } = useTheme();
  const [results, setResults] = useState<{ relPath: string; name: string }[]>([]);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!worktreeId) {
      setResults([]);
      setHint(null);
      return;
    }
    if (query.length < MIN_QUERY_LEN) {
      setResults([]);
      setHint(`Escribe ≥${MIN_QUERY_LEN} caracteres para buscar archivos`);
      return;
    }
    setHint(null);
    let cancelled = false;
    const t = setTimeout(() => {
      window.jide.files
        .search(worktreeId, query, LAZY_LIMIT)
        .then((r) => {
          if (!cancelled) setResults(r);
        })
        .catch((err: unknown) => {
          console.error('[jide] files.search failed', err);
        });
    }, LAZY_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [worktreeId, query]);

  if (!worktreeId) return null;

  return (
    <Command.Group heading="Archivos">
      {hint && (
        <Command.Item
          disabled
          value="__files-hint__"
          style={{
            opacity: 0.6,
            fontStyle: 'italic',
            padding: '8px 10px',
            color: theme.textMed,
          }}
        >
          {hint}
        </Command.Item>
      )}
      {results.map((f) => (
        <Command.Item
          key={f.relPath}
          value={f.name}
          keywords={[f.relPath]}
          onSelect={() => {
            onSelect();
            onOpen(f.relPath);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 10px',
            borderRadius: 6,
            cursor: 'pointer',
            gap: 6,
          }}
        >
          <span>{f.name}</span>
          <span style={{ marginLeft: 8, opacity: 0.7, fontSize: 12 }}>{dirname(f.relPath)}</span>
        </Command.Item>
      ))}
    </Command.Group>
  );
}
