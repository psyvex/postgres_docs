'use client';

import { Moon, Sun } from 'lucide-react';
import { useT } from '@/lib/i18n/useT';

export function ThemeToggle() {
  const { t } = useT();
  const toggle = () => {
    const dark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem('postgres-lab:theme', dark ? 'dark' : 'light');
    } catch {}
  };
  return (
    <button onClick={toggle} aria-label={t.theme.toggle} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text">
      <Sun className="hidden h-4 w-4 dark:block" />
      <Moon className="h-4 w-4 dark:hidden" />
    </button>
  );
}
