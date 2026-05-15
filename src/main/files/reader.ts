import { readFile as fsReadFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { MAX_FILE_BYTES, type FileReadResult } from '@shared/files';

const BINARY_EXTENSIONS = new Set<string>([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp', '.tiff',
  '.pdf', '.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z',
  '.exe', '.dll', '.dylib', '.so', '.wasm',
  '.mp4', '.mov', '.mkv', '.webm', '.mp3', '.wav', '.flac', '.ogg',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.psd', '.ai', '.sketch',
]);

const LANG_BY_EXT: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.json': 'json',
  '.md': 'markdown',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
  '.sh': 'bash',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.toml': 'toml',
};

function hasNullByte(buf: Buffer, sampleSize: number): boolean {
  const limit = Math.min(buf.byteLength, sampleSize);
  for (let i = 0; i < limit; i++) {
    if (buf[i] === 0x00) return true;
  }
  return false;
}

export async function readFile(absPath: string): Promise<FileReadResult> {
  let size: number;
  let ext: string;
  try {
    const s = await stat(absPath);
    if (!s.isFile()) return { kind: 'missing' };
    size = s.size;
    ext = extname(absPath).toLowerCase();
  } catch {
    return { kind: 'missing' };
  }

  if (BINARY_EXTENSIONS.has(ext)) {
    return { kind: 'binary', sizeBytes: size, ext };
  }
  if (size > MAX_FILE_BYTES) {
    return { kind: 'too-large', sizeBytes: size };
  }

  const buf = await fsReadFile(absPath);
  if (hasNullByte(buf, 8192)) {
    return { kind: 'binary', sizeBytes: size, ext };
  }
  return {
    kind: 'text',
    content: buf.toString('utf8'),
    lang: LANG_BY_EXT[ext] ?? null,
    sizeBytes: size,
  };
}
