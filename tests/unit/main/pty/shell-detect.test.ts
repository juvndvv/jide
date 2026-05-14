import { describe, it, expect } from 'vitest';
import { detectShell } from '../../../../src/main/pty/shell-detect.js';

describe('detectShell', () => {
  it('returns $SHELL when it is set and exists on the filesystem', () => {
    const result = detectShell({ SHELL: '/usr/local/bin/fish' }, 'darwin', () => true);
    expect(result).toEqual({ command: '/usr/local/bin/fish', args: ['-l'] });
  });

  it('falls back to /bin/zsh when $SHELL is absent but /bin/zsh exists on darwin', () => {
    const result = detectShell({}, 'darwin', (p) => p === '/bin/zsh');
    expect(result).toEqual({ command: '/bin/zsh', args: ['-l'] });
  });

  it('falls back to /bin/bash when neither $SHELL nor /bin/zsh exist', () => {
    const result = detectShell({}, 'darwin', () => false);
    expect(result).toEqual({ command: '/bin/bash', args: ['-l'] });
  });

  it('returns pwsh.exe on Windows when PowerShell 7 is installed', () => {
    const pwshPath = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
    const result = detectShell({}, 'win32', (p) => p === pwshPath);
    expect(result).toEqual({ command: pwshPath, args: [] });
  });

  it('falls back to cmd.exe on Windows when PowerShell 7 is absent', () => {
    const result = detectShell({}, 'win32', () => false);
    expect(result).toEqual({ command: 'cmd.exe', args: [] });
  });
});
