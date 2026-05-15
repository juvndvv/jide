import { useEffect, useState } from 'react';
import type { Highlighter, BundledLanguage } from 'shiki';

const LANGS: BundledLanguage[] = [
  'typescript', 'tsx', 'javascript', 'jsx', 'json', 'markdown',
  'css', 'scss', 'html', 'bash', 'python', 'rust', 'go', 'yaml', 'toml',
];

let cached: Promise<Highlighter> | null = null;

function loadHighlighter(): Promise<Highlighter> {
  if (cached) return cached;
  cached = (async () => {
    console.time('[perf] shiki dynamic import');
    const { createHighlighter } = await import('shiki');
    console.timeEnd('[perf] shiki dynamic import');
    console.time('[perf] shiki createHighlighter');
    const hl = await createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: LANGS,
    });
    console.timeEnd('[perf] shiki createHighlighter');
    return hl;
  })();
  return cached;
}

export interface UseShiki {
  highlighter: Highlighter | null;
  ready: boolean;
}

export function useShiki(): UseShiki {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  useEffect(() => {
    let alive = true;
    void loadHighlighter().then((hl) => { if (alive) setHighlighter(hl); });
    return () => { alive = false; };
  }, []);
  return { highlighter, ready: highlighter !== null };
}
