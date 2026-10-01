// The one helper for the part of a string table that is not a constant string: a value dropped into
// a sentence.
//
// Deliberately tiny. ICU MessageFormat would do more (plurals, genders, select), but every
// translatable string in this app is a constant or one value in one sentence, and a formatter that
// cannot express anything else is the one that keeps that true. Plurals are deliberately absent: see
// the note at the top of `dictionaries/en.ts` for how the count strings are phrased to avoid them.

/** Fills `{name}` placeholders. Unknown keys are left as written, so a typo in a string shows up on
 *  screen as `{couint}` (visible, fixable) instead of an empty hole (invisible, silent). */
export function fmt(pattern: string, values: Record<string, string | number>): string {
  return pattern.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
