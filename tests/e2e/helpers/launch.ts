import { _electron as electron, type ElectronApplication } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const FAKE_CLAUDE_BIN = resolve(here, '../../fixtures/fake-claude.mjs');

export interface LaunchOptions {
  /** When set, main process replies to dialog.showOpenDialog with this path. Empty string simulates cancellation. */
  dialogReturnPath?: string;
  /** Override electron-store cwd. */
  storeCwd?: string;
  /** Override the resolved Claude CLI binary path (consumed by locator.ts). */
  claudeBinary?: string;
  /**
   * Path to a fake-claude script. When set, the main process spawns
   * `node fake-claude.mjs --script <path>` instead of the real CLI.
   */
  fakeClaudeScript?: string;
}

export async function launchJide(opts: LaunchOptions = {}): Promise<ElectronApplication> {
  return electron.launch({
    args: [resolve(process.cwd(), 'out/main/index.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_DISABLE_GPU: '1',
      ...(opts.dialogReturnPath !== undefined
        ? { JIDE_TEST_DIALOG_RETURN: opts.dialogReturnPath }
        : {}),
      ...(opts.storeCwd ? { JIDE_TEST_STORE_CWD: opts.storeCwd } : {}),
      ...(opts.claudeBinary ? { JIDE_CLAUDE_BINARY: opts.claudeBinary } : {}),
      ...(opts.fakeClaudeScript
        ? {
            JIDE_FAKE_CLAUDE_BIN: FAKE_CLAUDE_BIN,
            JIDE_CLAUDE_FAKE_SCRIPT: opts.fakeClaudeScript,
          }
        : {}),
    },
  });
}
