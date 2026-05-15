import { describe, it, expect, vi } from 'vitest';
import type * as NodePty from 'node-pty';
import { PtyManager } from '../../../../src/main/pty/manager.js';

interface StubProc {
  pid: number;
  command: string;
  args: string[];
  opts: NodePty.IPtyForkOptions;
  write: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
  _emitData: (d: string) => void;
}

function makeStubModule(): { procs: StubProc[]; module: typeof NodePty } {
  const procs: StubProc[] = [];
  const module = {
    spawn: vi.fn(
      (
        command: string,
        args: string[],
        opts: NodePty.IPtyForkOptions,
      ): NodePty.IPty => {
        const dataListeners = new Set<(d: string) => void>();
        const exitListeners = new Set<
          (e: { exitCode: number; signal?: number | string }) => void
        >();
        const stub: StubProc = {
          pid: 1000 + procs.length,
          command,
          args,
          opts,
          write: vi.fn(),
          resize: vi.fn(),
          kill: vi.fn(() => {
            for (const fn of exitListeners) fn({ exitCode: 0 });
          }),
          _emitData: (d: string) => {
            for (const fn of dataListeners) fn(d);
          },
        };
        procs.push(stub);
        return {
          pid: stub.pid,
          process: '' as string,
          cols: opts.cols ?? 80,
          rows: opts.rows ?? 24,
          handleFlowControl: false,
          onData: (fn: (d: string) => void) => {
            dataListeners.add(fn);
            return { dispose: () => dataListeners.delete(fn) };
          },
          onExit: (fn: (e: { exitCode: number; signal?: number | string }) => void) => {
            exitListeners.add(fn);
            return { dispose: () => exitListeners.delete(fn) };
          },
          write: (data: string): void => { stub.write(data); },
          resize: (cols: number, rows: number): void => { stub.resize(cols, rows); },
          kill: (signal?: string): void => { stub.kill(signal); },
          pause: () => {},
          resume: () => {},
        } as unknown as NodePty.IPty;
      },
    ),
  } as unknown as typeof NodePty;
  return { procs, module };
}

describe('PtyManager', () => {
  it('creates and returns pid', () => {
    const { module } = makeStubModule();
    const mgr = new PtyManager(() => ({ command: '/bin/zsh', args: ['-l'] }), module);
    const { pid } = mgr.create({ worktreeId: 'wt1', cwd: '/tmp', cols: 80, rows: 24 });
    expect(pid).toBe(1000);
    expect(mgr.has('wt1')).toBe(true);
  });

  it('create twice for same wt returns the existing pid (idempotent)', () => {
    const { module } = makeStubModule();
    const mgr = new PtyManager(() => ({ command: '/bin/zsh', args: ['-l'] }), module);
    const a = mgr.create({ worktreeId: 'wt1', cwd: '/tmp', cols: 80, rows: 24 });
    const b = mgr.create({ worktreeId: 'wt1', cwd: '/tmp', cols: 80, rows: 24 });
    expect(a.pid).toBe(b.pid);
  });

  it('emits data when the pty emits stdout', () => {
    const { module, procs } = makeStubModule();
    const mgr = new PtyManager(() => ({ command: 'x', args: [] }), module);
    const dataSpy = vi.fn();
    mgr.on('data', dataSpy);
    mgr.create({ worktreeId: 'wt1', cwd: '/tmp', cols: 80, rows: 24 });
    procs[0]!._emitData('hello');
    expect(dataSpy).toHaveBeenCalledWith({ worktreeId: 'wt1', data: 'hello' });
  });

  it('kill triggers exit event and removes from active', () => {
    const { module } = makeStubModule();
    const mgr = new PtyManager(() => ({ command: 'x', args: [] }), module);
    const exitSpy = vi.fn();
    mgr.on('exit', exitSpy);
    mgr.create({ worktreeId: 'wt1', cwd: '/tmp', cols: 80, rows: 24 });
    mgr.kill('wt1');
    expect(mgr.has('wt1')).toBe(false);
    expect(exitSpy).toHaveBeenCalledWith({ worktreeId: 'wt1', code: 0, signal: null });
  });

  it('killAll kills every active pty', () => {
    const { module } = makeStubModule();
    const mgr = new PtyManager(() => ({ command: 'x', args: [] }), module);
    mgr.create({ worktreeId: 'a', cwd: '/tmp', cols: 80, rows: 24 });
    mgr.create({ worktreeId: 'b', cwd: '/tmp', cols: 80, rows: 24 });
    mgr.killAll();
    expect(mgr.activeWorktrees()).toEqual([]);
  });

  it('write/resize no-op when worktree unknown', () => {
    const { module } = makeStubModule();
    const mgr = new PtyManager(() => ({ command: 'x', args: [] }), module);
    expect(() => mgr.write('zzz', 'data')).not.toThrow();
    expect(() => mgr.resize('zzz', 80, 24)).not.toThrow();
  });
});
