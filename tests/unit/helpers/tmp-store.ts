import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function tmpStoreDir(): { cwd: string; cleanup: () => void } {
  const cwd = mkdtempSync(join(tmpdir(), 'jide-store-'));
  return {
    cwd,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}
