import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import type { ThemeTokens, AccentTokens } from '../../theme/tokens.js';

const RESIZE_DEBOUNCE_MS = 100;

export interface UseXtermArgs {
  containerRef: RefObject<HTMLDivElement | null>;
  theme: ThemeTokens;
  accent: AccentTokens;
  onUserInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
}

export interface UseXtermResult {
  writeChunk: (data: string) => void;
}

export function useXterm({
  containerRef,
  theme,
  accent,
  onUserInput,
  onResize,
}: UseXtermArgs): UseXtermResult {
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const resizeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const term = new Terminal({
      fontFamily: 'Geist Mono, ui-monospace, monospace',
      fontSize: 12.5,
      cursorBlink: true,
      allowProposedApi: true,
      theme: xtermTheme(theme, accent),
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(container);
    try {
      fit.fit();
    } catch {
      /* container size 0 before paint */
    }
    onResize(term.cols, term.rows);
    const onDataDisposable = term.onData(onUserInput);

    const ro = new ResizeObserver(() => {
      if (resizeTimerRef.current !== null) window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = window.setTimeout(() => {
        try {
          fit.fit();
        } catch {
          /* skip */
        }
        onResize(term.cols, term.rows);
      }, RESIZE_DEBOUNCE_MS);
    });
    ro.observe(container);

    termRef.current = term;
    fitRef.current = fit;

    return () => {
      ro.disconnect();
      if (resizeTimerRef.current !== null) window.clearTimeout(resizeTimerRef.current);
      onDataDisposable.dispose();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!termRef.current) return;
    termRef.current.options.theme = xtermTheme(theme, accent);
  }, [theme, accent]);

  const writeChunk = useCallback((data: string): void => {
    termRef.current?.write(data);
  }, []);

  return { writeChunk };
}

function xtermTheme(theme: ThemeTokens, accent: AccentTokens): Record<string, string> {
  return {
    background: theme.codeBg,
    foreground: theme.text,
    cursor: accent.value,
    cursorAccent: theme.codeBg,
    selectionBackground: accent.value + '33',
    black: theme.text,
    brightBlack: theme.textMed,
    white: theme.text,
    brightWhite: theme.text,
  };
}
