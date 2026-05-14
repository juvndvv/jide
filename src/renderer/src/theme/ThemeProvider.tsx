import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import {
  ACCENTS,
  DENSITIES,
  THEME_DARK,
  THEME_LIGHT,
  type AccentId,
  type AccentTokens,
  type DensityId,
  type DensityTokens,
  type SidebarSide,
  type ThemeMode,
  type ThemeTokens,
} from './tokens';

export interface ThemeContextValue {
  mode: ThemeMode;
  effectiveMode: 'light' | 'dark';
  theme: ThemeTokens;
  accent: AccentTokens;
  density: DensityTokens;
  sidebarSide: SidebarSide;
  setMode: (mode: ThemeMode) => void;
  setAccent: (id: AccentId) => void;
  setDensity: (id: DensityId) => void;
  setSidebarSide: (side: SidebarSide) => void;
}

export const ThemeContextInternal = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  initial: {
    mode: ThemeMode;
    accent: AccentId;
    density: DensityId;
    sidebarSide: SidebarSide;
  };
  persist: {
    setMode: (mode: ThemeMode) => void;
    setAccent: (id: AccentId) => void;
    setDensity: (id: DensityId) => void;
    setSidebarSide: (side: SidebarSide) => void;
  };
}

function resolveEffectiveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children, initial, persist }: ThemeProviderProps): JSX.Element {
  const [mode, setModeState] = useState<ThemeMode>(initial.mode);
  const [accentId, setAccentState] = useState<AccentId>(initial.accent);
  const [densityId, setDensityState] = useState<DensityId>(initial.density);
  const [sidebarSide, setSidebarSideState] = useState<SidebarSide>(initial.sidebarSide);
  const [effectiveMode, setEffective] = useState<'light' | 'dark'>(() =>
    resolveEffectiveMode(initial.mode),
  );

  // Subscribe to prefers-color-scheme only when mode === 'auto'.
  useEffect(() => {
    if (mode !== 'auto') {
      setEffective(mode);
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (): void => setEffective(mq.matches ? 'dark' : 'light');
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [mode]);

  const accent = ACCENTS[accentId];

  // Keep the CSS var in sync so keyframes (jidePulse) follow the active accent.
  useEffect(() => {
    document.documentElement.style.setProperty('--jide-accent', accent.value);
  }, [accent.value]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      persist.setMode(next);
    },
    [persist],
  );
  const setAccent = useCallback(
    (id: AccentId) => {
      setAccentState(id);
      persist.setAccent(id);
    },
    [persist],
  );
  const setDensity = useCallback(
    (id: DensityId) => {
      setDensityState(id);
      persist.setDensity(id);
    },
    [persist],
  );
  const setSidebarSide = useCallback(
    (side: SidebarSide) => {
      setSidebarSideState(side);
      persist.setSidebarSide(side);
    },
    [persist],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      effectiveMode,
      theme: effectiveMode === 'dark' ? THEME_DARK : THEME_LIGHT,
      accent,
      density: DENSITIES[densityId],
      sidebarSide,
      setMode,
      setAccent,
      setDensity,
      setSidebarSide,
    }),
    [mode, effectiveMode, accent, densityId, sidebarSide, setMode, setAccent, setDensity, setSidebarSide],
  );

  return <ThemeContextInternal.Provider value={value}>{children}</ThemeContextInternal.Provider>;
}
