import { gitExec } from './exec.js';

export async function listBranches(repoRoot: string): Promise<string[]> {
  const { stdout } = await gitExec(repoRoot, [
    'for-each-ref',
    '--format=%(refname:short)',
    'refs/heads/',
  ]);
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}
