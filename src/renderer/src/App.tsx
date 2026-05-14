import { useEffect, useState } from 'react';
import type { ThemeMode } from '@shared/settings';

export function App() {
  const [theme, setTheme] = useState<ThemeMode | null>(null);

  useEffect(() => {
    void window.jide.settings.get('theme').then(setTheme);
  }, []);

  const cycle = async () => {
    const order: ThemeMode[] = ['auto', 'light', 'dark'];
    const next = order[(order.indexOf(theme ?? 'auto') + 1) % order.length] ?? 'auto';
    await window.jide.settings.set('theme', next);
    setTheme(next);
  };

  return (
    <main
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <h1
        data-testid="wordmark"
        style={{
          fontFamily: '"Bowlby One SC", Anton, Impact, sans-serif',
          fontSize: 96,
          letterSpacing: -2,
          color: 'var(--jide-accent)',
          margin: 0,
        }}
      >
        jide
      </h1>
      <button
        type="button"
        data-testid="theme-toggle"
        onClick={() => void cycle()}
        style={{
          padding: '8px 16px',
          fontFamily: 'inherit',
          borderRadius: 8,
          border: '1px solid #00000020',
          background: '#FFFFFF',
          cursor: 'pointer',
        }}
      >
        theme: <span data-testid="theme-value">{theme ?? '…'}</span>
      </button>
    </main>
  );
}
