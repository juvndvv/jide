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

export async function gitExec(repoRoot: string, args: readonly string[]): Promise<GitExecResult> {
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
    if (err instanceof ExecaError) {
      const stdout = typeof err.stdout === 'string' ? err.stdout : '';
      const stderr = typeof err.stderr === 'string' ? err.stderr : '';
      throw new GitError(args, err.exitCode ?? -1, stdout, stderr);
    }
    throw err;
  }
}
