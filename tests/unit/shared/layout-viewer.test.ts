import { describe, expect, it } from 'vitest';
import {
  closeViewer,
  makeEmptyLayout,
  openViewer,
  setViewerPath,
  setViewerRatio,
  toggleViewer,
} from '../../../src/shared/layout';

describe('viewer state ops', () => {
  it('makeEmptyLayout starts viewer closed with default ratio', () => {
    const l = makeEmptyLayout();
    expect(l.viewer).toEqual({ open: false, path: null, ratio: 0.28 });
  });

  it('openViewer with null preserves null path', () => {
    const next = openViewer(makeEmptyLayout(), null);
    expect(next.viewer).toEqual({ open: true, path: null, ratio: 0.28 });
  });

  it('openViewer with path sets path and opens', () => {
    const next = openViewer(makeEmptyLayout(), 'src/foo.ts');
    expect(next.viewer.open).toBe(true);
    expect(next.viewer.path).toBe('src/foo.ts');
  });

  it('toggleViewer flips open and preserves path', () => {
    const a = openViewer(makeEmptyLayout(), 'a.ts');
    const b = toggleViewer(a);
    expect(b.viewer.open).toBe(false);
    expect(b.viewer.path).toBe('a.ts');
    const c = toggleViewer(b);
    expect(c.viewer.open).toBe(true);
    expect(c.viewer.path).toBe('a.ts');
  });

  it('closeViewer is a no-op when already closed', () => {
    const l = makeEmptyLayout();
    expect(closeViewer(l)).toBe(l);
  });

  it('setViewerRatio clamps to [0.15, 0.6]', () => {
    const l = makeEmptyLayout();
    expect(setViewerRatio(l, 0.01).viewer.ratio).toBe(0.15);
    expect(setViewerRatio(l, 0.9).viewer.ratio).toBe(0.6);
    expect(setViewerRatio(l, 0.35).viewer.ratio).toBe(0.35);
  });

  it('setViewerPath updates only path', () => {
    const l = openViewer(makeEmptyLayout(), 'a.ts');
    const next = setViewerPath(l, 'b.ts');
    expect(next.viewer.path).toBe('b.ts');
    expect(next.viewer.open).toBe(true);
  });
});
