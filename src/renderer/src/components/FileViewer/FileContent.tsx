import type { JSX } from 'react';
import { useMemo } from 'react';
import type { FileReadResult } from '@shared/files';
import { useTheme } from '../../theme/useTheme';
import { useShiki } from './useShiki';
import { BinaryFilePlaceholder } from './BinaryFilePlaceholder';
import { TooLargePlaceholder } from './TooLargePlaceholder';

export interface FileContentProps {
  result: FileReadResult | null;
  loading: boolean;
}

export function FileContent({ result, loading }: FileContentProps): JSX.Element {
  const { theme, effectiveMode } = useTheme();
  const { highlighter, ready } = useShiki();

  const html = useMemo<string | null>(() => {
    if (!result || result.kind !== 'text') return null;
    if (!ready || !highlighter) return null;
    try {
      return highlighter.codeToHtml(result.content, {
        lang: result.lang ?? 'text',
        theme: effectiveMode === 'dark' ? 'github-dark' : 'github-light',
      });
    } catch {
      return null;
    }
  }, [result, highlighter, ready, effectiveMode]);

  if (loading || !result) {
    return <div style={{ padding: 12, color: theme.textMed, fontSize: 12 }}>Cargando…</div>;
  }
  if (result.kind === 'missing') {
    return <div style={{ padding: 12, color: theme.textMed, fontSize: 12 }}>Archivo no encontrado.</div>;
  }
  if (result.kind === 'binary') {
    return <BinaryFilePlaceholder ext={result.ext} sizeBytes={result.sizeBytes} />;
  }
  if (result.kind === 'too-large') {
    return <TooLargePlaceholder sizeBytes={result.sizeBytes} />;
  }

  if (html) {
    return (
      <div
        style={{
          overflow: 'auto',
          fontSize: 12,
          padding: 0,
          background: theme.codeBg,
          flex: 1,
          minHeight: 0,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <pre
      style={{
        margin: 0,
        padding: 12,
        fontSize: 12,
        color: theme.text,
        background: theme.codeBg,
        whiteSpace: 'pre',
        overflow: 'auto',
        flex: 1,
        minHeight: 0,
      }}
    >
      {result.content}
    </pre>
  );
}
