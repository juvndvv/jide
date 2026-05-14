import { spawn, type ChildProcess } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const FAKE_CLAUDE = resolve(here, '../../fixtures/fake-claude.mjs');

export interface RunFakeClaudeOptions {
  scriptPath: string;
  cwd?: string;
}

export function runFakeClaude(opts: RunFakeClaudeOptions): ChildProcess {
  return spawn('node', [FAKE_CLAUDE, '--script', opts.scriptPath], {
    cwd: opts.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

export function fakeClaudeArgs(scriptPath: string): string[] {
  return [FAKE_CLAUDE, '--script', scriptPath];
}
