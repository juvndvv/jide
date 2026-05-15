import { describe, it, expect } from 'vitest';
import {
  makeEmptyLayout,
  countLeaves,
  findLeaf,
  findSplit,
  splitLeaf,
  mergeLeaf,
  assignSession,
  toggleAxis,
  setRatio,
  pruneOrphans,
  flattenLeafIds,
  MAX_CHAT_PANES,
  type PaneTree,
  type PaneLeaf,
  type PaneSplit,
} from '@shared/layout';

function buildTree(depth: number): PaneTree {
  if (depth <= 0) {
    return { kind: 'leaf', id: `leaf-${Math.random().toString(36).slice(2)}`, sessionId: null };
  }
  const left = buildTree(depth - 1);
  const right = buildTree(depth - 1);
  return {
    kind: 'split',
    id: `split-${Math.random().toString(36).slice(2)}`,
    axis: 'h',
    ratio: 0.5,
    first: left,
    second: right,
  };
}

function buildAtCap(): PaneTree {
  const leaf1: PaneLeaf = { kind: 'leaf', id: 'l1', sessionId: null };
  const leaf2: PaneLeaf = { kind: 'leaf', id: 'l2', sessionId: null };
  const leaf3: PaneLeaf = { kind: 'leaf', id: 'l3', sessionId: null };
  const leaf4: PaneLeaf = { kind: 'leaf', id: 'l4', sessionId: null };
  const split1: PaneSplit = { kind: 'split', id: 's1', axis: 'h', ratio: 0.5, first: leaf1, second: leaf2 };
  const split2: PaneSplit = { kind: 'split', id: 's2', axis: 'h', ratio: 0.5, first: leaf3, second: leaf4 };
  return { kind: 'split', id: 's0', axis: 'v', ratio: 0.5, first: split1, second: split2 };
}

describe('shared/layout — makeEmptyLayout', () => {
  it('returns a single empty leaf with terminal off and ratio 0.6', () => {
    const layout = makeEmptyLayout();
    expect(layout.panes.kind).toBe('leaf');
    expect((layout.panes as PaneLeaf).sessionId).toBeNull();
    expect(layout.terminal).toBe('off');
    expect(layout.terminalRatio).toBe(0.6);
  });

  it('activePaneId matches the root leaf id', () => {
    const layout = makeEmptyLayout();
    expect(layout.activePaneId).toBe(layout.panes.id);
  });
});

describe('shared/layout — countLeaves', () => {
  it('counts 1 for a single leaf', () => {
    const { panes } = makeEmptyLayout();
    expect(countLeaves(panes)).toBe(1);
  });

  it('counts 2 after one split', () => {
    const { panes } = makeEmptyLayout();
    const split = splitLeaf(panes, panes.id, 'h');
    expect(countLeaves(split)).toBe(2);
  });

  it('counts leaves in a deep tree', () => {
    const tree = buildTree(2);
    expect(countLeaves(tree)).toBe(4);
  });
});

describe('shared/layout — splitLeaf', () => {
  it('increases leaf count by 1', () => {
    const { panes } = makeEmptyLayout();
    const before = countLeaves(panes);
    const after = countLeaves(splitLeaf(panes, panes.id, 'h'));
    expect(after).toBe(before + 1);
  });

  it('produces a split with original leaf as first and a fresh empty leaf as second', () => {
    const { panes } = makeEmptyLayout();
    const originalId = panes.id;
    const result = splitLeaf(panes, originalId, 'h');
    expect(result.kind).toBe('split');
    const split = result as PaneSplit;
    expect(split.first.id).toBe(originalId);
    expect(split.second.kind).toBe('leaf');
    expect((split.second as PaneLeaf).sessionId).toBeNull();
    expect(split.second.id).not.toBe(originalId);
  });

  it('sets axis h correctly', () => {
    const { panes } = makeEmptyLayout();
    const result = splitLeaf(panes, panes.id, 'h') as PaneSplit;
    expect(result.axis).toBe('h');
  });

  it('sets axis v correctly', () => {
    const { panes } = makeEmptyLayout();
    const result = splitLeaf(panes, panes.id, 'v') as PaneSplit;
    expect(result.axis).toBe('v');
  });

  it('is a no-op at MAX_CHAT_PANES cap', () => {
    const tree = buildAtCap();
    expect(countLeaves(tree)).toBe(MAX_CHAT_PANES);
    const leafId = (((tree as PaneSplit).first as PaneSplit).first as PaneLeaf).id;
    const result = splitLeaf(tree, leafId, 'h');
    expect(countLeaves(result)).toBe(MAX_CHAT_PANES);
    expect(result).toBe(tree);
  });

  it('is a no-op with unknown leafId', () => {
    const { panes } = makeEmptyLayout();
    const result = splitLeaf(panes, 'nonexistent-id', 'h');
    expect(result).toStrictEqual(panes);
    expect(countLeaves(result)).toBe(1);
  });
});

describe('shared/layout — mergeLeaf', () => {
  it('sibling replaces the parent split when one side is merged', () => {
    const leaf: PaneLeaf = { kind: 'leaf', id: 'root', sessionId: null };
    const result = splitLeaf(leaf, 'root', 'h') as PaneSplit;
    const secondId = result.second.id;
    const merged = mergeLeaf(result, secondId);
    expect(merged.kind).toBe('leaf');
    expect(merged.id).toBe('root');
  });

  it('merging the only root leaf returns a fresh empty leaf', () => {
    const { panes } = makeEmptyLayout();
    const result = mergeLeaf(panes, panes.id);
    expect(result.kind).toBe('leaf');
    expect((result as PaneLeaf).sessionId).toBeNull();
    expect(result.id).not.toBe(panes.id);
  });
});

describe('shared/layout — assignSession', () => {
  it('move-semantics: assigning a session already held by another leaf clears the original', () => {
    const leaf: PaneLeaf = { kind: 'leaf', id: 'l1', sessionId: null };
    const tree = splitLeaf(leaf, 'l1', 'h') as PaneSplit;
    const secondId = tree.second.id;
    const assigned = assignSession(tree, 'l1', 'sess-abc') as PaneSplit;
    const moved = assignSession(assigned, secondId, 'sess-abc') as PaneSplit;
    expect((moved.first as PaneLeaf).sessionId).toBeNull();
    expect((moved.second as PaneLeaf).sessionId).toBe('sess-abc');
  });

  it('assigning null clears the target leaf', () => {
    const leaf: PaneLeaf = { kind: 'leaf', id: 'l1', sessionId: 'sess-xyz' };
    const result = assignSession(leaf, 'l1', null) as PaneLeaf;
    expect(result.sessionId).toBeNull();
  });

  it('returns tree unchanged for unknown leafId', () => {
    const { panes } = makeEmptyLayout();
    const result = assignSession(panes, 'no-such-leaf', 'sess-1');
    expect(result).toStrictEqual(panes);
  });
});

describe('shared/layout — toggleAxis', () => {
  it('flips h to v', () => {
    const leaf: PaneLeaf = { kind: 'leaf', id: 'l1', sessionId: null };
    const split = splitLeaf(leaf, 'l1', 'h') as PaneSplit;
    const result = toggleAxis(split, split.id) as PaneSplit;
    expect(result.axis).toBe('v');
  });

  it('flips v to h', () => {
    const leaf: PaneLeaf = { kind: 'leaf', id: 'l1', sessionId: null };
    const split = splitLeaf(leaf, 'l1', 'v') as PaneSplit;
    const result = toggleAxis(split, split.id) as PaneSplit;
    expect(result.axis).toBe('h');
  });

  it('returns tree unchanged for unknown splitId', () => {
    const { panes } = makeEmptyLayout();
    const result = toggleAxis(panes, 'no-split');
    expect(result).toStrictEqual(panes);
  });
});

describe('shared/layout — setRatio', () => {
  it('clamps below 0.1 to 0.1', () => {
    const leaf: PaneLeaf = { kind: 'leaf', id: 'l1', sessionId: null };
    const split = splitLeaf(leaf, 'l1', 'h') as PaneSplit;
    const result = setRatio(split, split.id, 0.05) as PaneSplit;
    expect(result.ratio).toBe(0.1);
  });

  it('clamps above 0.9 to 0.9', () => {
    const leaf: PaneLeaf = { kind: 'leaf', id: 'l1', sessionId: null };
    const split = splitLeaf(leaf, 'l1', 'h') as PaneSplit;
    const result = setRatio(split, split.id, 0.95) as PaneSplit;
    expect(result.ratio).toBe(0.9);
  });

  it('applies a valid ratio', () => {
    const leaf: PaneLeaf = { kind: 'leaf', id: 'l1', sessionId: null };
    const split = splitLeaf(leaf, 'l1', 'h') as PaneSplit;
    const result = setRatio(split, split.id, 0.65) as PaneSplit;
    expect(result.ratio).toBe(0.65);
  });
});

describe('shared/layout — pruneOrphans', () => {
  it('clears refs not in the valid set and keeps valid ones', () => {
    const l1: PaneLeaf = { kind: 'leaf', id: 'l1', sessionId: 'sess-keep' };
    const l2: PaneLeaf = { kind: 'leaf', id: 'l2', sessionId: 'sess-gone' };
    const tree: PaneSplit = { kind: 'split', id: 's1', axis: 'h', ratio: 0.5, first: l1, second: l2 };
    const valid = new Set(['sess-keep']);
    const result = pruneOrphans(tree, valid) as PaneSplit;
    expect((result.first as PaneLeaf).sessionId).toBe('sess-keep');
    expect((result.second as PaneLeaf).sessionId).toBeNull();
  });

  it('does not alter tree shape', () => {
    const l1: PaneLeaf = { kind: 'leaf', id: 'l1', sessionId: 'stale' };
    const result = pruneOrphans(l1, new Set()) as PaneLeaf;
    expect(result.kind).toBe('leaf');
    expect(result.id).toBe('l1');
    expect(result.sessionId).toBeNull();
  });

  it('leaves null sessionIds untouched', () => {
    const l1: PaneLeaf = { kind: 'leaf', id: 'l1', sessionId: null };
    const result = pruneOrphans(l1, new Set()) as PaneLeaf;
    expect(result.sessionId).toBeNull();
  });
});

describe('shared/layout — flattenLeafIds', () => {
  it('returns the single leaf id for a leaf tree', () => {
    const { panes } = makeEmptyLayout();
    expect(flattenLeafIds(panes)).toEqual([panes.id]);
  });

  it('returns left-to-right traversal', () => {
    const l1: PaneLeaf = { kind: 'leaf', id: 'l1', sessionId: null };
    const l2: PaneLeaf = { kind: 'leaf', id: 'l2', sessionId: null };
    const l3: PaneLeaf = { kind: 'leaf', id: 'l3', sessionId: null };
    const leftSplit: PaneSplit = { kind: 'split', id: 's-left', axis: 'h', ratio: 0.5, first: l1, second: l2 };
    const root: PaneSplit = { kind: 'split', id: 's-root', axis: 'v', ratio: 0.5, first: leftSplit, second: l3 };
    expect(flattenLeafIds(root)).toEqual(['l1', 'l2', 'l3']);
  });
});

describe('shared/layout — findLeaf', () => {
  it('returns the leaf if found', () => {
    const { panes } = makeEmptyLayout();
    const found = findLeaf(panes, panes.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(panes.id);
  });

  it('returns null if not found', () => {
    const { panes } = makeEmptyLayout();
    expect(findLeaf(panes, 'no-such-id')).toBeNull();
  });
});

describe('shared/layout — findSplit', () => {
  it('returns the split if found', () => {
    const leaf: PaneLeaf = { kind: 'leaf', id: 'l1', sessionId: null };
    const split = splitLeaf(leaf, 'l1', 'h') as PaneSplit;
    const found = findSplit(split, split.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(split.id);
  });

  it('returns null if not found', () => {
    const { panes } = makeEmptyLayout();
    expect(findSplit(panes, 'no-split')).toBeNull();
  });
});
