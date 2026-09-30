import { describe, expect, it } from 'vitest';
import { LANGUAGES, isRtl, languageLabel } from './languages';

describe('languageLabel', () => {
  it('accepts English, which is a translation target even though it is the source', () => {
    expect(languageLabel('en')).toBe('English');
  });

  it('labels every curated language', () => {
    for (const l of LANGUAGES) expect(languageLabel(l.code)).toBe(l.label);
  });

  it('returns null for anything else, so the server can reject it', () => {
    expect(languageLabel('xx')).toBeNull();
    expect(languageLabel(undefined)).toBeNull();
    expect(languageLabel('HI')).toBeNull();
  });
});

describe('isRtl', () => {
  it('is true for exactly the right-to-left scripts in the list', () => {
    expect(LANGUAGES.filter((l) => isRtl(l.code)).map((l) => l.code)).toEqual(['ur', 'ar']);
  });

  it('is false for LTR and unknown codes', () => {
    expect(isRtl('hi')).toBe(false);
    expect(isRtl(undefined)).toBe(false);
  });
});

describe('LANGUAGES', () => {
  it('has unique codes and a display name for each', () => {
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(LANGUAGES.length);
    for (const l of LANGUAGES) {
      expect(l.code).toMatch(/^[a-z]{2}$/);
      expect(l.label.length).toBeGreaterThan(1);
      expect(l.native.length).toBeGreaterThan(0);
    }
  });
});
