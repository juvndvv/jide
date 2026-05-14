import { _electron as electron, type ElectronApplication } from 'playwright';
import { resolve } from 'node:path';

export interface LaunchOptions {
  /** When set, main process replies to dialog.showOpenDialog with this path. Empty string simulates cancellation. */
  dialogReturnPath?: string;
  /** Override electron-store cwd. */
  storeCwd?: string;
  /** Override the resolved Claude CLI binary path (consumed by locator.ts). */
  claudeBinary?: string;
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
    },
  });
}
