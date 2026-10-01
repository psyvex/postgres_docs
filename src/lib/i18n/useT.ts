'use client';
// The one hook a component calls to get words. It is deliberately narrow: it returns a dictionary,
// not a `t(key)` function, so callers write `t.playground.history` and TypeScript resolves the
// property. A string-keyed `t('playground.history')` would have meant either a runtime lookup or a
// template-literal key type, and both lose the typo check that comes free this way.
import { useSyncExternalStore } from 'react';
import { getDictionary } from './dictionaries';
import type { Dictionary } from './dictionaries';
import { DEFAULT_UI_LANG, dirOf, type UiLangCode } from './languages';
import { getUiLang, subscribeUiLang } from './store';

export interface Text {
  /** Labels for the selected language. */
  t: Dictionary;
  /** Which language `t` is, for the control that selects it. */
  uiLang: UiLangCode;
  /** Which way the page runs, for the rare thing CSS cannot already do. */
  dir: 'ltr' | 'rtl';
}

export function useT(): Text {
  // `getUiLang` returns a module-level value, not a fresh object, which is what makes it a legal
  // snapshot: React compares with `Object.is` and would loop on a new object each call.
  // The server snapshot is English because nothing in the request says otherwise; see store.ts.
  const uiLang = useSyncExternalStore(subscribeUiLang, getUiLang, () => DEFAULT_UI_LANG);
  return { t: getDictionary(uiLang), uiLang, dir: dirOf(uiLang) };
}
