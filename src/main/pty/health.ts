export interface NativeProbeResult {
  ok: boolean;
  reason?: string;
}

/**
 * Verify node-pty's native binding loads. Called on app boot.
 * If false, terminal handlers should still register (so the renderer
 * gets a clear error) but the manager won't be initialised.
 */
export async function probeNativeBindings(): Promise<NativeProbeResult> {
  try {
    const mod = await import('node-pty');
    if (typeof mod.spawn !== 'function') {
      return { ok: false, reason: 'node-pty loaded but spawn is not a function' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
