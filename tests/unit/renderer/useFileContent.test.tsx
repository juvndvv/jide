// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileContent } from '@renderer/shortcuts/useFileContent';
import type { FileReadResult } from '@shared/files';

function setupJideMock(options?: { readResult?: FileReadResult; readDelay?: number }) {
  const readResult: FileReadResult = options?.readResult ?? {
    kind: 'text',
    content: 'hello',
    lang: null,
    sizeBytes: 5,
  };
  const read = vi.fn(
    () =>
      new Promise<FileReadResult>((resolve) => {
        if (options?.readDelay) {
          setTimeout(() => resolve(readResult), options.readDelay);
        } else {
          resolve(readResult);
        }
      }),
  );
  (window as unknown as Record<string, unknown>).jide = {
    files: { read },
    on: vi.fn(() => () => {}),
  };
  return { read };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useFileContent', () => {
  it('resets loading to false when inputs become null mid-flight', async () => {
    vi.useFakeTimers();

    // Slow read that will still be in-flight when inputs change to null
    const { read } = setupJideMock({ readDelay: 500 });

    let worktreeId: string | null = 'wt-1';
    let relPath: string | null = 'src/app.ts';

    const { result, rerender } = renderHook(() => useFileContent(worktreeId, relPath));

    // Effect fires synchronously on mount; loading should be true now
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(true);
    expect(read).toHaveBeenCalledOnce();

    // Switch to null inputs while the fetch is still in-flight
    worktreeId = null;
    relPath = null;

    act(() => {
      rerender();
    });

    // loading must be false immediately — not stuck waiting for the in-flight fetch
    expect(result.current.loading).toBe(false);
    expect(result.current.result).toBeNull();

    vi.useRealTimers();
  });

  it('resolves result and clears loading for valid inputs', async () => {
    setupJideMock();

    const { result } = renderHook(() => useFileContent('wt-1', 'src/app.ts'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.result).toEqual({
      kind: 'text',
      content: 'hello',
      lang: null,
      sizeBytes: 5,
    });
  });

  it('returns null result and loading false for null inputs from the start', () => {
    setupJideMock();

    const { result } = renderHook(() => useFileContent(null, null));

    expect(result.current.loading).toBe(false);
    expect(result.current.result).toBeNull();
  });
});
