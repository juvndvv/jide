import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES } from '../../../../src/shared/files';
import { readFile } from '../../../../src/main/files/reader';

describe('readFile', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'jide-reader-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('returns kind:text with content, lang, and sizeBytes for a known text extension', async () => {
    const path = join(root, 'index.ts');
    const content = 'export const x = 1;';
    await writeFile(path, content);
    const result = await readFile(path);
    expect(result).toEqual({
      kind: 'text',
      content,
      lang: 'typescript',
      sizeBytes: Buffer.byteLength(content, 'utf8'),
    });
  });

  it('returns kind:text with lang:null for an unknown extension', async () => {
    const path = join(root, 'data.xyz');
    const content = 'hello world';
    await writeFile(path, content);
    const result = await readFile(path);
    expect(result.kind).toBe('text');
    if (result.kind === 'text') {
      expect(result.lang).toBeNull();
      expect(result.content).toBe(content);
    }
  });

  it('returns kind:text with lang:null for a file with no extension', async () => {
    const path = join(root, 'Makefile');
    const content = 'all:\n\techo done';
    await writeFile(path, content);
    const result = await readFile(path);
    expect(result.kind).toBe('text');
    if (result.kind === 'text') {
      expect(result.lang).toBeNull();
    }
  });

  it('returns kind:too-large when file exceeds MAX_FILE_BYTES', async () => {
    const path = join(root, 'big.ts');
    const buf = Buffer.alloc(MAX_FILE_BYTES + 1, 'a');
    await writeFile(path, buf);
    const result = await readFile(path);
    expect(result.kind).toBe('too-large');
    if (result.kind === 'too-large') {
      expect(result.sizeBytes).toBe(MAX_FILE_BYTES + 1);
    }
  });

  it('returns kind:text when file is exactly MAX_FILE_BYTES', async () => {
    const path = join(root, 'exact.ts');
    const buf = Buffer.alloc(MAX_FILE_BYTES, 'a');
    await writeFile(path, buf);
    const result = await readFile(path);
    expect(result.kind).toBe('text');
    if (result.kind === 'text') {
      expect(result.sizeBytes).toBe(MAX_FILE_BYTES);
    }
  });

  it('returns kind:binary for a known binary extension without reading content', async () => {
    const path = join(root, 'image.png');
    await writeFile(path, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const result = await readFile(path);
    expect(result.kind).toBe('binary');
    if (result.kind === 'binary') {
      expect(result.ext).toBe('.png');
    }
  });

  it('returns kind:binary when a text-extension file contains a null byte in the first 8KB', async () => {
    const path = join(root, 'sneaky.ts');
    const buf = Buffer.concat([Buffer.from('hello world'), Buffer.from([0x00])]);
    await writeFile(path, buf);
    const result = await readFile(path);
    expect(result.kind).toBe('binary');
  });

  it('returns kind:text when null byte appears after the first 8192 bytes', async () => {
    const path = join(root, 'late-null.ts');
    const prefix = Buffer.alloc(9000, 0x61); // 'a' x 9000
    const suffix = Buffer.concat([Buffer.from([0x00]), Buffer.from('b')]);
    await writeFile(path, Buffer.concat([prefix, suffix]));
    const result = await readFile(path);
    expect(result.kind).toBe('text');
  });

  it('returns kind:missing for a path that does not exist', async () => {
    const result = await readFile(join(root, 'nonexistent.ts'));
    expect(result).toEqual({ kind: 'missing' });
  });

  it('returns kind:missing when the path is a directory', async () => {
    const dir = join(root, 'subdir');
    await mkdir(dir);
    const result = await readFile(dir);
    expect(result).toEqual({ kind: 'missing' });
  });

  it.each([
    ['.tsx', 'tsx'],
    ['.js', 'javascript'],
    ['.md', 'markdown'],
    ['.yml', 'yaml'],
    ['.yaml', 'yaml'],
  ])('maps extension %s to lang %s', async (ext, expectedLang) => {
    const path = join(root, `file${ext}`);
    await writeFile(path, 'content');
    const result = await readFile(path);
    expect(result.kind).toBe('text');
    if (result.kind === 'text') {
      expect(result.lang).toBe(expectedLang);
    }
  });
});
