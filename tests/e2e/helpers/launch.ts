import { _electron as electron, type ElectronApplication } from 'playwright';
import { resolve } from 'node:path';

export async function launchJide(): Promise<ElectronApplication> {
  return electron.launch({
    args: [resolve(process.cwd(), 'out/main/index.js')],
    env: { ...process.env, NODE_ENV: 'test', ELECTRON_DISABLE_GPU: '1' },
  });
}
