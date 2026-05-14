import { existsSync } from 'node:fs';

export interface ShellSpec {
  command: string;
  args: string[];
}

/**
 * Pure detector. Receives env + platform so tests can inject scenarios.
 */
export function detectShell(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  fsCheck: (p: string) => boolean = existsSync,
): ShellSpec {
  if (platform === 'win32') {
    if (fsCheck('C:\\Program Files\\PowerShell\\7\\pwsh.exe')) {
      return { command: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe', args: [] };
    }
    return { command: 'cmd.exe', args: [] };
  }
  const fromEnv = env.SHELL;
  if (fromEnv && fsCheck(fromEnv)) {
    return { command: fromEnv, args: ['-l'] };
  }
  if (fsCheck('/bin/zsh')) return { command: '/bin/zsh', args: ['-l'] };
  return { command: '/bin/bash', args: ['-l'] };
}
