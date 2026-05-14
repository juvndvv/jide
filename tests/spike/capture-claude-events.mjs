#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../fixtures/claude-events');
mkdirSync(OUT_DIR, { recursive: true });

async function capture(name, args, stdinInput) {
  const outPath = join(OUT_DIR, `${name}.ndjson`);
  const sink = createWriteStream(outPath);
  console.log(`\n=== ${name} ===`);
  console.log(`  args: ${args.join(' ')}`);

  const proc = spawn('claude', args, {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: process.env,
  });

  if (stdinInput !== undefined) {
    proc.stdin.write(stdinInput);
    proc.stdin.end();
  } else {
    proc.stdin.end();
  }

  const rl = createInterface({ input: proc.stdout });
  const types = new Set();
  rl.on('line', (line) => {
    sink.write(line + '\n');
    try {
      const evt = JSON.parse(line);
      if (typeof evt.type === 'string') types.add(evt.type);
    } catch { /* ignore — capture raw */ }
  });

  const timeout = setTimeout(() => {
    console.warn(`  ! ${name} timed out — killing`);
    proc.kill('SIGTERM');
  }, 60_000);

  const exitCode = await new Promise((res) => proc.on('exit', res));
  clearTimeout(timeout);
  sink.end();
  console.log(`  exit: ${exitCode}`);
  console.log(`  events: ${[...types].sort().join(', ') || '(none)'}`);
  console.log(`  -> ${outPath}`);
}

// The CLI requires --verbose whenever --print is paired with --output-format=stream-json.
const baseStreamArgs = ['-p', '--verbose', '--output-format', 'stream-json'];

// 1. Simple text — baseline event flow.
await capture(
  'simple-text',
  [...baseStreamArgs, '--model', 'haiku', '--permission-mode', 'bypassPermissions', 'Say hello in five words.'],
);

// 2. With a tool use.
await capture(
  'with-tool-use',
  [...baseStreamArgs, '--model', 'haiku', '--permission-mode', 'bypassPermissions', 'Run `pwd` and tell me the path. One command, then summarize.'],
);

// 3. With approval — may block or refuse in -p mode.
// When --input-format stream-json is set, the CLI ignores the positional prompt
// and reads user messages from stdin; we feed one user message and close stdin.
await capture(
  'with-approval',
  [...baseStreamArgs, '--input-format', 'stream-json', '--model', 'haiku', '--permission-mode', 'default'],
  JSON.stringify({
    type: 'user',
    message: { role: 'user', content: [{ type: 'text', text: 'Run `ls` in this directory.' }] },
  }) + '\n',
);

// 4. Error — invalid model.
await capture(
  'error',
  [...baseStreamArgs, '--model', 'this-model-does-not-exist-xyz', 'hello'],
);

console.log('\nDone.');
