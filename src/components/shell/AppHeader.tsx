'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';
import { DbModeSwitch } from './DbModeSwitch';
import { ThemeToggle } from './ThemeToggle';
import { BrandMark } from '@/components/brand/BrandMark';

const NAV = [
  { href: '/learn/row-level-security', match: '/learn', label: 'Learn' },
  { href: '/playground', match: '/playground', label: 'Playground' },
];

export function AppHeader() {
  const pathname = usePathname();
  const [replay, setReplay] = useState(0);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="flex h-14 w-full items-center gap-3 px-4 sm:gap-6">
        <Link href="/" onMouseEnter={() => setReplay((r) => r + 1)} className="flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight">
          <BrandMark key={replay} size={30} mode="once" />
          <span className="hidden sm:inline">Postgres Lab</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                pathname.startsWith(item.match) ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-text',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-l border-line pl-3 sm:pl-4">
          <DbModeSwitch />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
