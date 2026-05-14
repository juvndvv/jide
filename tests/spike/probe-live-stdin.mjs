#!/usr/bin/env node
// Scenario A probe: does the CLI accept additional user.message events on stdin
// after an initial prompt while a stream-json session is live?
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createWriteStream, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../fixtures/claude-events');
mkdirSync(OUT_DIR, { recursive: true });

const outPath = join(OUT_DIR, 'live-stdin-probe.ndjson');
const sink = createWriteStream(outPath);

const proc = spawn('claude', [
  '-p',
  '--verbose',
  '--output-format', 'stream-json',
  '--input-format', 'stream-json',
  '--model', 'haiku',
  '--permission-mode', 'bypassPermissions',
  '--include-partial-messages',
], { stdio: ['pipe', 'pipe', 'inherit'] });

const rl = createInterface({ input: proc.stdout });
const types = new Set();
rl.on('line', (line) => {
  sink.write(line + '\n');
  try {
    const evt = JSON.parse(line);
    if (typeof evt.type === 'string') types.add(evt.type);
    console.log('OUT:', evt.type, evt.subtype || '');
  } catch {
    console.log('OUT raw:', line.slice(0, 120));
  }
});

// Send initial prompt as a stream-json user message.
const send = (obj) => {
  const s = JSON.stringify(obj) + '\n';
  console.log('IN :', s.trim().slice(0, 120));
  proc.stdin.write(s);
};

send({
  type: 'user',
  message: { role: 'user', content: [{ type: 'text', text: 'Say A.' }] },
});

setTimeout(() => {
  send({
    type: 'user',
    message: { role: 'user', content: [{ type: 'text', text: 'Now say B.' }] },
  });
}, 8000);

setTimeout(() => {
  console.log('CLIENT: closing stdin');
  proc.stdin.end();
}, 16000);

const hardKill = setTimeout(() => {
  console.warn('Hard timeout — killing');
  proc.kill('SIGTERM');
}, 60000);

proc.on('exit', (code) => {
  clearTimeout(hardKill);
  sink.end();
  console.log('EXIT:', code);
  console.log('types:', [...types].sort().join(', '));
  console.log('->', outPath);
});
