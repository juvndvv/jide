import { useContext } from 'react';
import { ThemeContextInternal, type ThemeContextValue } from './ThemeProvider';

export function useTheme(): ThemeContextValue {
  const v = useContext(ThemeContextInternal);
  if (!v) throw new Error('useTheme() must be used within <ThemeProvider>');
  return v;
}
