function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type PaneAxis = 'h' | 'v';
export type TerminalSplit = 'off' | 'bottom' | 'side';

export interface PaneLeaf {
  kind: 'leaf';
  id: string;
  sessionId: string | null;
}

export interface PaneSplit {
  kind: 'split';
  id: string;
  axis: PaneAxis;
  /** Ratio between first and second (0..1, default 0.5). */
  ratio: number;
  first: PaneTree;
  second: PaneTree;
}

export type PaneTree = PaneLeaf | PaneSplit;

export interface WorktreeLayout {
  /** Binary tree of chat panes. Always non-empty (initial state: single empty leaf). */
  panes: PaneTree;
  /** Active leaf — focus target for keyboard / new sessions. */
  activePaneId: string;
  /** Terminal orientation. 'off' hides the panel; 'bottom' = below chat; 'side' = right of chat. */
  terminal: TerminalSplit;
  /** Ratio chat-vs-terminal (0..1). Only relevant when terminal !== 'off'. */
  terminalRatio: number;
}

export const MAX_CHAT_PANES = 4;

export function makeEmptyLayout(): WorktreeLayout {
  const id = newId();
  const leaf: PaneLeaf = { kind: 'leaf', id, sessionId: null };
  return { panes: leaf, activePaneId: id, terminal: 'off', terminalRatio: 0.6 };
}

export function countLeaves(tree: PaneTree): number {
  if (tree.kind === 'leaf') return 1;
  return countLeaves(tree.first) + countLeaves(tree.second);
}

export function findLeaf(tree: PaneTree, leafId: string): PaneLeaf | null {
  if (tree.kind === 'leaf') return tree.id === leafId ? tree : null;
  return findLeaf(tree.first, leafId) ?? findLeaf(tree.second, leafId);
}

export function findSplit(tree: PaneTree, splitId: string): PaneSplit | null {
  if (tree.kind === 'leaf') return null;
  if (tree.id === splitId) return tree;
  return findSplit(tree.first, splitId) ?? findSplit(tree.second, splitId);
}

export function splitLeaf(tree: PaneTree, leafId: string, axis: PaneAxis): PaneTree {
  if (countLeaves(tree) >= MAX_CHAT_PANES) return tree;
  return splitLeafInner(tree, leafId, axis) ?? tree;
}

function splitLeafInner(tree: PaneTree, leafId: string, axis: PaneAxis): PaneTree | null {
  if (tree.kind === 'leaf') {
    if (tree.id !== leafId) return null;
    const newLeaf: PaneLeaf = { kind: 'leaf', id: newId(), sessionId: null };
    const split: PaneSplit = { kind: 'split', id: newId(), axis, ratio: 0.5, first: tree, second: newLeaf };
    return split;
  }
  const newFirst = splitLeafInner(tree.first, leafId, axis);
  if (newFirst !== null) return { ...tree, first: newFirst };
  const newSecond = splitLeafInner(tree.second, leafId, axis);
  if (newSecond !== null) return { ...tree, second: newSecond };
  return null;
}

export function mergeLeaf(tree: PaneTree, leafId: string): PaneTree {
  if (tree.kind === 'leaf') {
    if (tree.id !== leafId) return tree;
    const newLeaf: PaneLeaf = { kind: 'leaf', id: newId(), sessionId: null };
    return newLeaf;
  }
  const result = mergeLeafInner(tree, leafId);
  return result ?? tree;
}

function mergeLeafInner(tree: PaneSplit, leafId: string): PaneTree | null {
  if (tree.first.kind === 'leaf' && tree.first.id === leafId) return tree.second;
  if (tree.second.kind === 'leaf' && tree.second.id === leafId) return tree.first;
  if (tree.first.kind === 'split') {
    const result = mergeLeafInner(tree.first, leafId);
    if (result !== null) return { ...tree, first: result };
  }
  if (tree.second.kind === 'split') {
    const result = mergeLeafInner(tree.second, leafId);
    if (result !== null) return { ...tree, second: result };
  }
  return null;
}

export function assignSession(
  tree: PaneTree,
  leafId: string,
  sessionId: string | null,
  exclusive = true,
): PaneTree {
  if (findLeaf(tree, leafId) === null) return tree;
  const cleared = exclusive && sessionId !== null ? clearSession(tree, sessionId) : tree;
  return applySession(cleared, leafId, sessionId);
}

function clearSession(tree: PaneTree, sessionId: string): PaneTree {
  if (tree.kind === 'leaf') {
    return tree.sessionId === sessionId ? { ...tree, sessionId: null } : tree;
  }
  return { ...tree, first: clearSession(tree.first, sessionId), second: clearSession(tree.second, sessionId) };
}

function applySession(tree: PaneTree, leafId: string, sessionId: string | null): PaneTree {
  if (tree.kind === 'leaf') {
    return tree.id === leafId ? { ...tree, sessionId } : tree;
  }
  return { ...tree, first: applySession(tree.first, leafId, sessionId), second: applySession(tree.second, leafId, sessionId) };
}

export function toggleAxis(tree: PaneTree, splitId: string): PaneTree {
  if (tree.kind === 'leaf') return tree;
  if (tree.id === splitId) return { ...tree, axis: tree.axis === 'h' ? 'v' : 'h' };
  const newFirst = toggleAxis(tree.first, splitId);
  const newSecond = toggleAxis(tree.second, splitId);
  if (newFirst === tree.first && newSecond === tree.second) return tree;
  return { ...tree, first: newFirst, second: newSecond };
}

export function setRatio(tree: PaneTree, splitId: string, ratio: number): PaneTree {
  const clamped = Math.min(0.9, Math.max(0.1, ratio));
  if (tree.kind === 'leaf') return tree;
  if (tree.id === splitId) return { ...tree, ratio: clamped };
  const newFirst = setRatio(tree.first, splitId, clamped);
  const newSecond = setRatio(tree.second, splitId, clamped);
  if (newFirst === tree.first && newSecond === tree.second) return tree;
  return { ...tree, first: newFirst, second: newSecond };
}

export function pruneOrphans(tree: PaneTree, validSessionIds: ReadonlySet<string>): PaneTree {
  if (tree.kind === 'leaf') {
    if (tree.sessionId !== null && !validSessionIds.has(tree.sessionId)) {
      return { ...tree, sessionId: null };
    }
    return tree;
  }
  const newFirst = pruneOrphans(tree.first, validSessionIds);
  const newSecond = pruneOrphans(tree.second, validSessionIds);
  if (newFirst === tree.first && newSecond === tree.second) return tree;
  return { ...tree, first: newFirst, second: newSecond };
}

export function flattenLeafIds(tree: PaneTree): string[] {
  if (tree.kind === 'leaf') return [tree.id];
  return [...flattenLeafIds(tree.first), ...flattenLeafIds(tree.second)];
}
