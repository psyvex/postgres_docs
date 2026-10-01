'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';
import { Search } from 'lucide-react';
import { DbModeSwitch } from './DbModeSwitch';
import { ThemeToggle } from './ThemeToggle';
import { OPEN_PALETTE_EVENT } from './CommandPalette';
import { BrandMark } from '@/components/brand/BrandMark';
import { useT } from '@/lib/i18n/useT';

/** Opens the ⌘K palette, which listens for this event on the window. */
function openPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}

// `tKey`/`tShortKey` are looked up against the dictionary at render time so the labels follow the
// interface language. `short` is the label used below `sm` (T5-6).
const NAV: { href: string; match: string; tKey: 'learn' | 'playground'; tShortKey: 'learn' | 'play' }[] = [
  { href: '/learn/row-level-security', match: '/learn', tKey: 'learn', tShortKey: 'learn' },
  { href: '/playground', match: '/playground', tKey: 'playground', tShortKey: 'play' },
];

export function AppHeader() {
  const pathname = usePathname();
  const { t } = useT();
  const [replay, setReplay] = useState(0);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="flex h-14 w-full items-center gap-2 px-3 sm:gap-6 sm:px-4">
        <Link href="/" onMouseEnter={() => setReplay((r) => r + 1)} className="flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight">
          <BrandMark key={replay} size={30} mode="once" />
          <span className="hidden sm:inline">Postgres Lab</span>
        </Link>
        <nav className="ms-auto flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'rounded-lg px-2 py-1.5 text-[13px] font-semibold transition sm:px-3 sm:text-sm',
                pathname.startsWith(item.match) ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-text',
              )}
            >
              {/* "Playground" does not fit a 320 px row alongside the DB chip, so the row carries
                  a short label below `sm` (T5-6). Both spans are in the a11y tree; one is hidden. */}
              <span className="hidden sm:inline">{t.header[item.tKey]}</span>
              <span className="sm:hidden">{t.header[item.tShortKey]}</span>
            </Link>
          ))}
        </nav>
        {/* The divider is a luxury at 320 px: its 12 px of padding is what pushes the row over. */}
        <div className="flex items-center gap-2 border-s border-line ps-3 sm:ps-4 max-sm:border-s-0 max-sm:ps-0">
          <button
            type="button"
            onClick={openPalette}
            title={`${t.header.search} (⌘K)`}
            aria-label={t.header.searchAria}
            className="hidden items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-semibold text-muted transition hover:border-brand hover:text-brand sm:flex"
          >
            <Search className="h-3.5 w-3.5" />
            <kbd className="hidden font-mono text-[10px] sm:inline">⌘K</kbd>
          </button>
          <DbModeSwitch />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
