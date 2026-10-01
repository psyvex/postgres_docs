/**
 * Target languages for lesson translation (same curated set as the research repo:
 * major Indian languages first, then widely used world languages). English is the
 * source language; picking it shows the original lesson.
 */
export const LANGUAGES = [
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'or', label: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'ur', label: 'Urdu', native: 'اردو', rtl: true },
  { code: 'es', label: 'Spanish', native: 'Español' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'de', label: 'German', native: 'Deutsch' },
  { code: 'pt', label: 'Portuguese', native: 'Português' },
  { code: 'it', label: 'Italian', native: 'Italiano' },
  { code: 'zh', label: 'Chinese (Simplified)', native: '简体中文' },
  { code: 'ja', label: 'Japanese', native: '日本語' },
  { code: 'ko', label: 'Korean', native: '한국어' },
  { code: 'ar', label: 'Arabic', native: 'العربية', rtl: true },
  { code: 'ru', label: 'Russian', native: 'Русский' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

/** Accepts the 21 translation targets plus `en`: translating *into* English is a real request
 *  (e.g. selecting a passage in a translated lesson). */
export function languageLabel(code: string | undefined) {
  if (code === 'en') return 'English';
  return LANGUAGES.find((l) => l.code === code)?.label ?? null;
}

export function isRtl(code: string | undefined) {
  const lang = LANGUAGES.find((l) => l.code === code);
  return Boolean(lang && 'rtl' in lang && lang.rtl);
}
