// Interface-language preference: the fourth kind of stored setting this app has, and shaped like the
// oldest one (`lib/learn/progress.ts`, `lib/storage/keys.ts`) rather than like the database store.
//
// Why not zustand + persist, like the DB store? Because the value has to be readable from a
// `<script>` that runs before React boots (`app/layout.tsx` sets `lang`/`dir` on the pre-paint path,
// next to the theme script) and by `useSyncExternalStore` without dragging React into module scope.
// A plain module store keeps both readers one line long.
//
// SSR rule: reads are guarded, and the React side supplies an explicit server snapshot ('en'), so a
// server render never contains a language the request did not ask for and hydration never disagrees
// with the HTML it is hydrating. React re-reads the client snapshot immediately after hydration.
import { DEFAULT_UI_LANG, dirOf, isUiLangCode, type UiLangCode } from './languages';

const KEY = 'postgres-lab:ui-lang';

let cached: UiLangCode | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

/** The stored choice, or English. First call reads storage; after that this module is the source. */
export function getUiLang(): UiLangCode {
  if (cached === null) {
    cached = DEFAULT_UI_LANG;
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(KEY);
        if (isUiLangCode(raw)) cached = raw;
      } catch {
        /* private mode, or storage disabled: English is always available. */
      }
    }
  }
  return cached;
}

export function setUiLang(code: UiLangCode): void {
  cached = code;
  try {
    window.localStorage.setItem(KEY, code);
  } catch {
    /* The in-memory value is already set, so the interface still switches. */
  }
  // `lang`/`dir` are also set before first paint; they have to follow a change made after boot too.
  document.documentElement.lang = code;
  document.documentElement.dir = dirOf(code);
  notify();
}

export function subscribeUiLang(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Puts the document back the way the stored language wants it. Called once on mount, because the
 *  pre-paint script only runs on a full load: a change from another tab, or a storage wipe from
 *  /settings, leaves `<html>` describing a language this page no longer renders. */
export function syncDocumentLanguage(): void {
  if (typeof window === 'undefined') return;
  const code = getUiLang();
  if (document.documentElement.lang !== code) document.documentElement.lang = code;
  const dir = dirOf(code);
  if (document.documentElement.dir !== dir) document.documentElement.dir = dir;
}

export const UI_LANG_KEY = KEY;
