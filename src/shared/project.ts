export type WorktreeStatus = 'clean' | 'modified';

export type ClaudeState = 'idle' | 'running' | 'awaiting' | 'error';

export interface Worktree {
  id: string;
  branch: string;
  path: string;
  head: string;
  status: WorktreeStatus;
  claude: ClaudeState;
  changes: number;
  ahead: number;
  behind: number;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  expanded: boolean;
}
