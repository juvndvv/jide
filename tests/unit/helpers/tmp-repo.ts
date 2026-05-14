import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execaSync } from 'execa';

export interface TmpRepo {
  cwd: string;
  cleanup: () => void;
  /** Run a shell command inside the repo. Throws if it exits non-zero. */
  run: (cmd: string, args: string[]) => string;
  /** Create or overwrite a file relative to the repo root. */
  writeFile: (relPath: string, content: string) => void;
  /** `git add -A && git commit -m <message>`. */
  commit: (message: string) => void;
}

export function tmpRepo(): TmpRepo {
  const cwd = mkdtempSync(join(tmpdir(), 'jide-git-'));

  const run = (cmd: string, args: string[]): string => {
    const { stdout } = execaSync(cmd, args, { cwd, env: cleanGitEnv() });
    return stdout;
  };

  run('git', ['init', '--initial-branch=main']);
  run('git', ['config', 'user.email', 'test@jide.local']);
  run('git', ['config', 'user.name', 'jide test']);
  run('git', ['config', 'commit.gpgsign', 'false']);

  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
    run,
    writeFile: (relPath, content) => {
      const fullPath = join(cwd, relPath);
      mkdirSync(join(fullPath, '..'), { recursive: true });
      writeFileSync(fullPath, content);
    },
    commit: (message) => {
      run('git', ['add', '-A']);
      run('git', ['commit', '-m', message, '--allow-empty']);
    },
  };
}

function cleanGitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('GIT_')) delete env[key];
  }
  return env;
}
