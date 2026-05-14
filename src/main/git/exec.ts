import { execa, ExecaError } from 'execa';

export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class GitError extends Error {
  readonly args: readonly string[];
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  constructor(args: readonly string[], exitCode: number, stdout: string, stderr: string) {
    super(`git ${args.join(' ')} exited with code ${exitCode}: ${stderr.trim()}`);
    this.name = 'GitError';
    this.args = args;
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

/**
 * Errors that suggest the failure is transient — fork ran out of resources
 * (fds, memory, processes) or the process was killed before producing output.
 * These deserve a retry with backoff rather than surfacing immediately.
 */
function isTransientSpawnFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as NodeJS.ErrnoException).code;
  if (code === 'EMFILE' || code === 'ENFILE' || code === 'EAGAIN' || code === 'ENOMEM') {
    return true;
  }
  // execa surfaces a killed-before-output process as exitCode=null+empty
  // stdout/stderr; we mapped that to -1 below. Treat it as transient when
  // there's truly no signal of what failed.
  if (err instanceof ExecaError) {
    const exitCode = err.exitCode ?? null;
    const stdout = typeof err.stdout === 'string' ? err.stdout : '';
    const stderr = typeof err.stderr === 'string' ? err.stderr : '';
    if ((exitCode === null || exitCode < 0) && stdout === '' && stderr === '') {
      return true;
    }
  }
  return false;
}

export async function gitExec(repoRoot: string, args: readonly string[]): Promise<GitExecResult> {
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const r = await execa('git', args as string[], {
        cwd: repoRoot,
        stdin: 'ignore',
        env: { LC_ALL: 'C', LANG: 'C' },
        timeout: 30_000,
      });
      return {
        stdout: r.stdout,
        stderr: r.stderr,
        exitCode: r.exitCode ?? 0,
      };
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS - 1 && isTransientSpawnFailure(err)) {
        // 100ms, 250ms backoff — give the OS time to free fds.
        const delay = 100 * Math.pow(2.5, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      break;
    }
  }
  if (lastErr instanceof ExecaError) {
    const stdout = typeof lastErr.stdout === 'string' ? lastErr.stdout : '';
    const stderr = typeof lastErr.stderr === 'string' ? lastErr.stderr : '';
    throw new GitError(args, lastErr.exitCode ?? -1, stdout, stderr);
  }
  throw lastErr;
}
