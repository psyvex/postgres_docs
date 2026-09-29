'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => undefined });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  useEffect(() => { const saved = window.localStorage.getItem('postgres-lab-theme'); const next = saved === 'light' ? 'light' : 'dark'; setTheme(next); document.documentElement.dataset.theme = next; }, []);
  const toggle = () => setTheme((current) => { const next = current === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; window.localStorage.setItem('postgres-lab-theme', next); return next; });
  const value = useMemo(() => ({ theme, toggle }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
