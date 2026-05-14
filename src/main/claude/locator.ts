import { execaSync, ExecaError } from 'execa';

/** Resolved location and reported version of the `claude` CLI. */
export interface ClaudeBinary {
  path: string;
  version: string;
}

let override: string | null = null;

/** Test-only: pin the binary path that {@link claudeBinary} returns. */
export function setClaudeBinaryForTests(path: string | null): void {
  override = path;
}

/**
 * Resolve the `claude` executable. Order:
 *   1. Test override set via {@link setClaudeBinaryForTests}.
 *   2. `JIDE_CLAUDE_BINARY` environment variable (E2E seam).
 *   3. `which claude` on PATH.
 */
export function claudeBinary(): string {
  if (override) return override;
  const fromEnv = process.env.JIDE_CLAUDE_BINARY;
  if (fromEnv) return fromEnv;
  return locateClaude().path;
}

/** Locate the `claude` executable and capture its --version string. */
export function locateClaude(): ClaudeBinary {
  try {
    const { stdout: pathOut } = execaSync('which', ['claude']);
    const resolvedPath = pathOut.trim();
    const { stdout: versionOut } = execaSync(resolvedPath, ['--version']);
    return { path: resolvedPath, version: versionOut.trim() };
  } catch (err) {
    if (err instanceof ExecaError) {
      const stderr = typeof err.stderr === 'string' ? err.stderr : '';
      throw new Error(`claude not found on PATH: ${stderr || err.message}`);
    }
    throw err;
  }
}
