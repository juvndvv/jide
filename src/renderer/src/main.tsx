import { StrictMode, useEffect, useMemo, useState, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './theme/ThemeProvider';
import type { AccentId, DensityId, SidebarSide, ThemeMode } from './theme/tokens';
import './styles.css';

interface InitialSettings {
  mode: ThemeMode;
  accent: AccentId;
  density: DensityId;
  sidebarSide: SidebarSide;
}

function Root(): JSX.Element | null {
  const [initial, setInitial] = useState<InitialSettings | null>(null);

  useEffect(() => {
    Promise.all([
      window.jide.settings.get('theme'),
      window.jide.settings.get('accent'),
      window.jide.settings.get('density'),
      window.jide.settings.get('sidebarSide'),
    ])
      .then(([mode, accent, density, sidebarSide]) => {
        setInitial({ mode, accent, density, sidebarSide });
      })
      .catch((err: unknown) => {
        console.error('[jide] settings boot failed', err);
        setInitial({ mode: 'auto', accent: 'coral', density: 'comfy', sidebarSide: 'left' });
      });
  }, []);

  const persist = useMemo(
    () => ({
      setMode: (m: ThemeMode) => {
        void window.jide.settings.set('theme', m);
      },
      setAccent: (a: AccentId) => {
        void window.jide.settings.set('accent', a);
      },
      setDensity: (d: DensityId) => {
        void window.jide.settings.set('density', d);
      },
      setSidebarSide: (s: SidebarSide) => {
        void window.jide.settings.set('sidebarSide', s);
      },
    }),
    [],
  );

  if (!initial) return null;

  return (
    <ThemeProvider initial={initial} persist={persist}>
      <App />
    </ThemeProvider>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('No #root');
createRoot(container).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
