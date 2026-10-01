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
// interface language. `short` is the label used below `sm` (T5-6). `exam` needs no separate short form:
// every locale's word for it is six characters or fewer.
//
// Three items is the most this row can carry at 320 px, and only because the database chip stopped
// spending width on a word (see `DbModeSwitch`). Measured with all three labels in all six interface
// languages at 320 px: `scrollWidth` equals `clientWidth` (309) and the rightmost edge of anything in
// the header is 309. Spanish is the tight case — `Aprender · Lab · Examen` is 173 px of nav against
// English's 142 — so any fourth item, or any word made longer, has to be measured in Spanish and not
// in English.
const NAV: {
  href: string;
  match: string;
  tKey: 'learn' | 'playground' | 'exam';
  tShortKey: 'learn' | 'play' | 'exam';
}[] = [
  { href: '/learn/row-level-security', match: '/learn', tKey: 'learn', tShortKey: 'learn' },
  { href: '/playground', match: '/playground', tKey: 'playground', tShortKey: 'play' },
  { href: '/exam', match: '/exam', tKey: 'exam', tShortKey: 'exam' },
];

// The home page is the marketing page: its header points at the page's own sections, plus the one app
// destination a visitor can try without reading anything. `wide` items drop out below `sm`, so the 320 px
// row carries two links and no database chip, which is less than the app header already fits.
const MARKETING: { href: string; tKey: 'lessons' | 'labs' | 'roadmap' | 'playground'; wide?: boolean }[] = [
  { href: '#lessons', tKey: 'lessons' },
  { href: '#labs', tKey: 'labs', wide: true },
  { href: '#roadmap', tKey: 'roadmap', wide: true },
  { href: '/playground', tKey: 'playground' },
];

export function AppHeader() {
  const pathname = usePathname();
  const { t } = useT();
  const [replay, setReplay] = useState(0);
  const marketing = pathname === '/';
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="flex h-14 w-full items-center gap-2 px-3 sm:gap-6 sm:px-4">
        <Link href="/" onMouseEnter={() => setReplay((r) => r + 1)} className="flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight">
          <BrandMark key={replay} size={30} mode="once" />
          <span className="hidden sm:inline">Postgres Lab</span>
        </Link>
        <nav className="ms-auto flex items-center gap-1">
          {marketing && MARKETING.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'rounded-lg px-2 py-1.5 text-[13px] font-semibold text-muted transition hover:bg-surface-2 hover:text-text sm:px-3 sm:text-sm',
                item.wide && 'hidden sm:inline',
              )}
            >
              {item.tKey === 'playground' ? (
                <>
                  <span className="hidden sm:inline">{t.header.playground}</span>
                  <span className="sm:hidden">{t.header.play}</span>
                </>
              ) : (
                t.header[item.tKey]
              )}
            </Link>
          ))}
          {!marketing && NAV.map((item) => (
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
          {/* Local vs live database means nothing to a first-time visitor; it is app chrome, not marketing. */}
          {!marketing && <DbModeSwitch />}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
