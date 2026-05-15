const IGNORED_SEGMENTS = [
  '.git',
  'node_modules',
  'dist',
  'out',
  '.vite',
  '.next',
  'coverage',
  '.turbo',
  'target',
  'build',
] as const;

const IGNORED_NAMES = new Set<string>(['.DS_Store', 'Thumbs.db']);

/**
 * Returns true if the given POSIX relative path should be excluded from the
 * file tree and the watcher. Matches whole segments only — `src/.gitignore`
 * is NOT ignored just because '.git' appears as a substring.
 */
export function isIgnoredPath(relPath: string): boolean {
  if (relPath === '') return false;
  const segments = relPath.split('/');
  for (const segment of segments) {
    if (IGNORED_NAMES.has(segment)) return true;
    if ((IGNORED_SEGMENTS as readonly string[]).includes(segment)) return true;
  }
  return false;
}
