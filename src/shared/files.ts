export type FileKind = 'file' | 'dir';

export interface FileNode {
  name: string;
  /** Path relative to the worktree root. Uses POSIX separators ('/') even on Windows. */
  relPath: string;
  kind: FileKind;
  /** Only for files. Set during readChildren via stat. */
  sizeBytes: number | null;
}

export type GitFileStatus = 'M' | 'A' | 'D' | 'R' | 'C' | 'U' | '??' | null;

export type FileReadResult =
  | { kind: 'text'; content: string; lang: string | null; sizeBytes: number }
  | { kind: 'binary'; sizeBytes: number; ext: string }
  | { kind: 'too-large'; sizeBytes: number }
  | { kind: 'missing' };

export type FileChangeKind = 'add' | 'change' | 'unlink' | 'add-dir' | 'unlink-dir';

export interface FileChangeEvent {
  worktreeId: string;
  /** Relative to the worktree root. POSIX separators. */
  relPath: string;
  kind: FileChangeKind;
}

export interface FileStatusChangeEvent {
  worktreeId: string;
  /** Sparse map — only entries that changed since last emission. */
  changes: Record<string, GitFileStatus>;
}

export const MAX_FILE_BYTES = 1024 * 1024;
