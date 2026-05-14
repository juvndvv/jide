import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore, type JideStore } from '../../../../src/main/store/index';
import {
  loadAllSessions,
  saveSessionsForWorktree,
  clearSessionsForWorktree,
} from '../../../../src/main/claude/persistence';
import type { PersistedSession } from '@shared/session';

function makeSnap(uuid: string, worktreeId: string, title: string): PersistedSession {
  return {
    id: { worktreeId, uuid },
    status: 'idle',
    model: 'sonnet',
    cwd: '/tmp',
    title,
    createdAt: 1_700_000_000_000,
    messages: [],
    rateLimit: null,
    awaitingToolUseId: null,
    totalCostUsd: 0.0042,
  };
}

let store: JideStore;
let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'jide-persist-'));
  store = createStore({ cwd });
});

describe('session persistence', () => {
  it('returns an empty map when no sessions have been saved', () => {
    expect(loadAllSessions(store)).toEqual({});
  });

  it('roundtrips a list of sessions per worktree', () => {
    const a = makeSnap('aaa', 'wt-1', 'Session A');
    const b = makeSnap('bbb', 'wt-1', 'Session B');
    saveSessionsForWorktree(store, 'wt-1', [a, b]);
    expect(loadAllSessions(store)).toEqual({ 'wt-1': [a, b] });

    const c = makeSnap('ccc', 'wt-2', 'Session C');
    saveSessionsForWorktree(store, 'wt-2', [c]);
    expect(loadAllSessions(store)).toEqual({ 'wt-1': [a, b], 'wt-2': [c] });
  });

  it('clearing a worktree removes its entry without touching others', () => {
    saveSessionsForWorktree(store, 'wt-1', [makeSnap('aaa', 'wt-1', 'A')]);
    saveSessionsForWorktree(store, 'wt-2', [makeSnap('bbb', 'wt-2', 'B')]);
    clearSessionsForWorktree(store, 'wt-1');
    expect(loadAllSessions(store)).toEqual({ 'wt-2': [makeSnap('bbb', 'wt-2', 'B')] });
  });

  it('saving an empty list deletes the worktree key', () => {
    saveSessionsForWorktree(store, 'wt-1', [makeSnap('aaa', 'wt-1', 'A')]);
    saveSessionsForWorktree(store, 'wt-1', []);
    expect(loadAllSessions(store)).toEqual({});
  });
});
