#!/usr/bin/env node
/**
 * Deterministic stand-in for `claude -p --output-format stream-json
 * --input-format stream-json`.
 *
 * Usage:
 *   node fake-claude.mjs --script <path-to-script.json>
 *
 * Each step in the script is one of:
 *
 *   { "kind": "emit",       "delayMs": 50, "event": <json object> }
 *     — write `event` as a single NDJSON line on stdout after delayMs.
 *
 *   { "kind": "echo-stdin", "expect": "user" }
 *     — wait for one NDJSON line on stdin. If `expect` is set, parse the line
 *       and verify its `type` field matches; abort otherwise.
 *
 *   { "kind": "exit", "code": 0 }
 *     — exit immediately with the given code.
 *
 * Does not read any env var besides PATH. Does not perform network I/O.
 * The fake-claude.mjs is the test seam for ClaudeSession: ClaudeSession
 * spawns the binary identified by `claudeBinary()` (the locator's
 * override hook), which the test sets to `node` + `fake-claude.mjs`.
 */

import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { argv, stdout, stdin, exit, stderr } from 'node:process';

function parseArgs() {
  const i = argv.indexOf('--script');
  if (i === -1 || !argv[i + 1]) {
    stderr.write('fake-claude.mjs requires --script <path>\n');
    exit(2);
  }
  return argv[i + 1];
}

async function run() {
  const scriptPath = parseArgs();
  const steps = JSON.parse(readFileSync(scriptPath, 'utf8'));

  const rl = createInterface({ input: stdin });
  const queue = [];
  let resolver = null;
  rl.on('line', (line) => {
    if (resolver) {
      const r = resolver;
      resolver = null;
      r(line);
    } else {
      queue.push(line);
    }
  });

  function readOneStdinLine() {
    if (queue.length) return Promise.resolve(queue.shift());
    return new Promise((resolve) => {
      resolver = resolve;
    });
  }

  for (const step of steps) {
    if (step.kind === 'emit') {
      if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));
      stdout.write(JSON.stringify(step.event) + '\n');
    } else if (step.kind === 'echo-stdin') {
      const line = await readOneStdinLine();
      if (step.expect) {
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch {
          stderr.write(`fake-claude: stdin line is not JSON: ${line}\n`);
          exit(3);
        }
        if (parsed?.type !== step.expect) {
          stderr.write(
            `fake-claude: stdin line type "${parsed?.type}" did not match expected "${step.expect}"\n`,
          );
          exit(4);
        }
      }
    } else if (step.kind === 'exit') {
      exit(step.code ?? 0);
    } else {
      stderr.write(`fake-claude: unknown step kind: ${step.kind}\n`);
      exit(5);
    }
  }
  exit(0);
}

run().catch((err) => {
  stderr.write(String(err) + '\n');
  exit(1);
});
