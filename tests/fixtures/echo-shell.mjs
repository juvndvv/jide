#!/usr/bin/env node
process.stdin.setRawMode?.(true);
process.stdin.resume();

let buffer = '';

process.stdout.write('> ');

process.stdin.on('data', (chunk) => {
  for (const byte of chunk) {
    const c = String.fromCharCode(byte);
    if (c === '\r') {
      process.stdout.write('\r\n');
      if (buffer === 'exit') {
        process.exit(0);
      }
      buffer = '';
      process.stdout.write('> ');
    } else if (c === '\x7f') {
      // backspace
      if (buffer.length > 0) {
        buffer = buffer.slice(0, -1);
        process.stdout.write('\b \b');
      }
    } else {
      buffer += c;
      process.stdout.write(c);
    }
  }
});
