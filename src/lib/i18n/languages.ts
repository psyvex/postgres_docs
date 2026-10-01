// Interface languages: the languages the app's own chrome has a string table for.
//
// This list is deliberately NOT the AI answer-language list (`src/lib/ai/languages.ts`, eight languages,
// which is what the translator and the three copilot entry points ask the model to reply in). The two
// settings are independent on purpose: a learner can read the interface in Spanish and still get answers
// in English, and the model answers in languages we have no UI strings for.
//
// Arabic is here because it is the reason the feature exists - it is the only one of the four that
// changes the writing direction of the whole app (`dirOf` feeds the `dir` attribute, and the layout uses
// Tailwind's logical utilities so the chrome mirrors with it).
export type UiLangCode = 'en' | 'es' | 'hi' | 'ar' | 'ja' | 'zh';

export type UiLang = {
  code: UiLangCode;
  /** Stays English in every interface: it is the language's name in its own language's script, which is
   *  what makes the option recognisable to someone who reads the interface in a different language. */
  native: string;
  english: string;
  dir: 'ltr' | 'rtl';
};

export const UI_LANGUAGES: readonly UiLang[] = [
  { code: 'en', native: 'English', english: 'English', dir: 'ltr' },
  { code: 'es', native: 'Español', english: 'Spanish', dir: 'ltr' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', dir: 'ltr' },
  { code: 'ar', native: 'العربية', english: 'Arabic', dir: 'rtl' },
  { code: 'ja', native: '日本語', english: 'Japanese', dir: 'ltr' },
  { code: 'zh', native: '简体中文', english: 'Chinese (Simplified)', dir: 'ltr' },
];

export const DEFAULT_UI_LANG: UiLangCode = 'en';

export function isUiLangCode(value: unknown): value is UiLangCode {
  return UI_LANGUAGES.some((l) => l.code === value);
}

/** Reading direction of a UI language. The pre-paint script in `app/layout.tsx` carries the same rule
 *  inline (it runs before this module is loaded, so it cannot import it); keep both in step. */
export function dirOf(code: UiLangCode): 'ltr' | 'rtl' {
  return UI_LANGUAGES.find((l) => l.code === code)?.dir ?? 'ltr';
}
