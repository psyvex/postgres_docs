'use client';

import clsx from 'clsx';
import { UI_LANGUAGES } from '@/lib/i18n/languages';
import { setUiLang } from '@/lib/i18n/store';
import { useT } from '@/lib/i18n/useT';

/**
 * A six-language segmented control for /settings.
 *
 * The selected language is read from `useT()` (a `useSyncExternalStore` snapshot), never mirrored
 * into local state, which keeps this component free of a `react-hooks/set-state-in-effect` site.
 * `setUiLang` is called inside the click handler rather than passed as a raw `onChange` prop to
 * avoid a `ref.current` read at render time (the other lint-rule trap in this codebase).
 *
 * The `dir="ltr"` on each native name ensures a Latin-script reader can read each language label even
 * when the page itself is in Arabic; the native name is the label, and it must stay readable.
 */
export function UiLanguageCard() {
  const { t, uiLang } = useT();

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-bold">{t.uiLang.cardTitle}</h2>
      <p className="mt-1 text-xs leading-snug text-muted">{t.uiLang.cardNote}</p>
      <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label={t.uiLang.cardTitle}>
        {UI_LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            dir="ltr"
            aria-pressed={uiLang === lang.code}
            onClick={() => setUiLang(lang.code)}
            className={clsx(
              'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition',
              uiLang === lang.code
                ? 'border-brand bg-brand-soft text-brand'
                : 'border-line text-muted hover:bg-surface-2 hover:text-text',
            )}
          >
            {lang.native}
            {lang.dir === 'rtl' && <span className="ms-1 text-[10px] opacity-60">RTL</span>}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">{t.uiLang.notComplete}</p>
    </div>
  );
}
