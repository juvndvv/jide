import { execa, ExecaError } from 'execa';

export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class GitError extends Error {
  readonly args: readonly string[];
  readonly exitCode: number;
  readonly stderr: string;
  constructor(args: readonly string[], exitCode: number, stderr: string) {
    super(`git ${args.join(' ')} exited with code ${exitCode}: ${stderr.trim()}`);
    this.name = 'GitError';
    this.args = args;
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

export async function gitExec(repoRoot: string, args: readonly string[]): Promise<GitExecResult> {
  try {
    const r = await execa('git', args as string[], {
      cwd: repoRoot,
      stdin: 'ignore',
      env: { LC_ALL: 'C', LANG: 'C' },
      extendEnv: true,
      timeout: 30_000,
    });
    return {
      stdout: r.stdout,
      stderr: r.stderr,
      exitCode: r.exitCode ?? 0,
    };
  } catch (err) {
    if (err instanceof ExecaError) {
      const stderr = typeof err.stderr === 'string' ? err.stderr : '';
      throw new GitError(args, err.exitCode ?? -1, stderr);
    }
    throw err;
  }
}
