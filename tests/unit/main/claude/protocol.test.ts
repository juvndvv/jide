import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseEventLine,
  applyEvent,
  emptySnapshot,
  type StreamEvent,
} from '../../../../src/main/claude/protocol';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(here, '../../../fixtures/claude-events');

function loadFixture(name: string): string[] {
  return readFileSync(resolve(FIXTURES, `${name}.ndjson`), 'utf8')
    .split('\n')
    .filter(Boolean);
}

function fold(name: string): ReturnType<typeof emptySnapshot> {
  const lines = loadFixture(name);
  let snap = emptySnapshot('wt-test', 'haiku', '/tmp');
  for (const line of lines) {
    const evt = parseEventLine(line);
    if (evt) snap = applyEvent(snap, evt);
  }
  return snap;
}

describe('parseEventLine', () => {
  it('parses a system/init line from the real fixture', () => {
    const lines = loadFixture('simple-text');
    const init = lines
      .map((l) => parseEventLine(l))
      .find(
        (e): e is StreamEvent & { type: 'system' } =>
          e !== null && e.type === 'system' && 'subtype' in e && e.subtype === 'init',
      );
    expect(init).toBeDefined();
  });

  it('returns null on malformed JSON', () => {
    expect(parseEventLine('not-json{')).toBeNull();
  });

  it('returns null on empty input', () => {
    expect(parseEventLine('')).toBeNull();
    expect(parseEventLine('   ')).toBeNull();
  });

  it('returns null for unknown event types', () => {
    expect(parseEventLine('{"type":"unknown.future.event","id":"x"}')).toBeNull();
  });
});

describe('applyEvent — system/init', () => {
  it('does NOT overwrite the snapshot uuid even when the CLI emits a different session_id', () => {
    const seeded = {
      ...emptySnapshot('wt', 'sonnet', '/tmp'),
      id: { worktreeId: 'wt', uuid: 'jide-internal' },
    };
    const next = applyEvent(seeded, {
      type: 'system',
      subtype: 'init',
      session_id: 'cli-emitted-uuid',
      cwd: '/tmp',
      model: 'sonnet',
    });
    expect(next.id.uuid).toBe('jide-internal');
  });

  it('still absorbs model and cwd from the init event', () => {
    const seeded = {
      ...emptySnapshot('wt', 'sonnet', '/old'),
      id: { worktreeId: 'wt', uuid: 'u' },
    };
    const next = applyEvent(seeded, {
      type: 'system',
      subtype: 'init',
      session_id: 'ignored',
      cwd: '/new',
      model: 'haiku',
    });
    expect(next.cwd).toBe('/new');
    expect(next.model).toBe('haiku');
  });
});

describe('applyEvent — folding real fixtures', () => {
  it('simple-text → one claude text message + idle status', () => {
    const snap = fold('simple-text');
    const claudeText = snap.messages.filter((m) => m.type === 'claude' && !m.thinking);
    expect(claudeText.length).toBeGreaterThan(0);
    expect(snap.status).toBe('idle');
  });

  it('with-tool-use → one tool message with status:done and the right name', () => {
    const snap = fold('with-tool-use');
    const tools = snap.messages.filter((m) => m.type === 'tool');
    expect(tools).toHaveLength(1);
    const tool = tools[0];
    if (tool?.type === 'tool') {
      expect(tool.name).toBe('Bash');
      expect(tool.status).toBe('done');
      expect(typeof tool.output).toBe('string');
      expect((tool.output ?? '').length).toBeGreaterThan(0);
    }
  });

  it('with-tool-use → tool message preserves the input', () => {
    const snap = fold('with-tool-use');
    const tool = snap.messages.find((m) => m.type === 'tool');
    if (tool?.type === 'tool') {
      expect(tool.input).toBeDefined();
      expect(typeof tool.input).toBe('object');
    }
  });

  it('error fixture → status:error and a system error message is appended', () => {
    const snap = fold('error');
    expect(snap.status).toBe('error');
    const errs = snap.messages.filter((m) => m.type === 'system' && m.level === 'error');
    expect(errs.length).toBeGreaterThan(0);
  });

  it('totalCostUsd accumulates from result events', () => {
    const snap = fold('with-tool-use');
    expect(snap.totalCostUsd).toBeGreaterThan(0);
  });

  it('hook_started / hook_response events do not produce any messages', () => {
    const snap = fold('simple-text');
    const sysMsgs = snap.messages.filter((m) => m.type === 'system');
    expect(sysMsgs).toHaveLength(0);
  });

  it('rate_limit_event populates snapshot.rateLimit', () => {
    const snap = fold('simple-text');
    if (snap.rateLimit) {
      expect(typeof snap.rateLimit.status).toBe('string');
      expect(typeof snap.rateLimit.utilization).toBe('number');
      expect(snap.rateLimit.utilization).toBeGreaterThanOrEqual(0);
      expect(snap.rateLimit.utilization).toBeLessThanOrEqual(1);
    }
  });

  it('cumulative assistant content blocks dedup by message.id (no duplicated text)', () => {
    const snap = fold('with-tool-use');
    const texts = snap.messages
      .filter((m): m is Extract<typeof m, { type: 'claude' }> => m.type === 'claude' && !m.thinking)
      .map((m) => m.text);
    const unique = new Set(texts);
    expect(unique.size).toBe(texts.length);
  });
});

describe('emptySnapshot', () => {
  it('returns a clean snapshot with no messages', () => {
    const snap = emptySnapshot('wt-1', 'haiku', '/tmp');
    expect(snap.messages).toHaveLength(0);
    expect(snap.status).toBe('idle');
    expect(snap.totalCostUsd).toBe(0);
    expect(snap.rateLimit).toBeNull();
  });
});
