import { describe, it, expect } from 'vitest';
import { createInterface } from 'node:readline';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runFakeClaude } from '../../helpers/fake-claude-runner';

const here = dirname(fileURLToPath(import.meta.url));
const SIMPLE_SCRIPT = resolve(here, '../../../fixtures/claude-events/simple.script.json');
const TOOL_SCRIPT = resolve(here, '../../../fixtures/claude-events/with-tool-use.script.json');

interface ContentBlock {
  type: string;
  id?: string;
  tool_use_id?: string;
}

interface FakeEvent {
  type: string;
  message?: { content?: ContentBlock[] };
}

function parseEvent(line: string): FakeEvent {
  return JSON.parse(line) as FakeEvent;
}

describe('fake-claude.mjs (smoke)', () => {
  it('emits the simple script events in order and exits 0', async () => {
    const proc = runFakeClaude({ scriptPath: SIMPLE_SCRIPT });
    const lines: string[] = [];
    const rl = createInterface({ input: proc.stdout! });
    rl.on('line', (l) => lines.push(l));
    const code = await new Promise<number | null>((r) => proc.on('exit', r));
    expect(code).toBe(0);
    expect(lines.length).toBeGreaterThan(0);
    const types = lines.map((l) => parseEvent(l).type);
    expect(types[0]).toBe('system');
    expect(types).toContain('assistant');
    expect(types[types.length - 1]).toBe('result');
  });

  it('emits the tool-use script with the tool_use id correlated to tool_result', async () => {
    const proc = runFakeClaude({ scriptPath: TOOL_SCRIPT });
    const lines: string[] = [];
    const rl = createInterface({ input: proc.stdout! });
    rl.on('line', (l) => lines.push(l));
    await new Promise<number | null>((r) => proc.on('exit', r));

    const events = lines.map(parseEvent);
    const toolUse = events.find(
      (e) => e.type === 'assistant' && e.message?.content?.some((b) => b.type === 'tool_use'),
    );
    const toolResult = events.find(
      (e) => e.type === 'user' && e.message?.content?.some((b) => b.type === 'tool_result'),
    );
    expect(toolUse).toBeDefined();
    expect(toolResult).toBeDefined();
    const toolUseBlock = toolUse?.message?.content?.find((b) => b.type === 'tool_use');
    const toolResultBlock = toolResult?.message?.content?.find((b) => b.type === 'tool_result');
    expect(toolUseBlock).toBeDefined();
    expect(toolResultBlock).toBeDefined();
    expect(toolResultBlock?.tool_use_id).toBe(toolUseBlock?.id);
  });
});
