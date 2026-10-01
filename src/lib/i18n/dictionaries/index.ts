import type { UiLangCode } from '../languages';
import { ar } from './ar';
import { en, type Dictionary } from './en';
import { es } from './es';
import { hi } from './hi';
import { ja } from './ja';
import { zh } from './zh';

/**
 * One object per interface language, all six complete. `en` is the shape (see `en.ts`), so
 * `Record<UiLangCode, Dictionary>` is the compile-time check that a key added to English gets
 * translated everywhere: omit one and this literal stops typechecking.
 */
export const dictionaries: Record<UiLangCode, Dictionary> = { en, es, hi, ar, ja, zh };

/** Total by types, with the fallback anyway: callers reach here with a value that came out of
 *  storage, and a stale or hand-edited key must degrade to English rather than crash a render. */
export function getDictionary(lang: UiLangCode): Dictionary {
  return dictionaries[lang] ?? en;
}

export type { Dictionary };
