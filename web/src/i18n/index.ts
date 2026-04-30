import { signal } from '@lit-labs/signals';
import { en, type TranslationKey } from './en.ts';
import { de } from './de.ts';
import { nb } from './nb.ts';

export type { TranslationKey };
export type SupportedLocale = 'en' | 'de' | 'nb';

export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'de', 'nb'];

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  de: 'Deutsch',
  nb: 'Norsk bokmål',
};

const translations: Record<SupportedLocale, Record<TranslationKey, string>> = { en, de, nb };

export function detectLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') {
    return 'en';
  }
  const langs = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : navigator.language ? [navigator.language] : [];
  for (const tag of langs) {
    const base = tag.split('-')[0].toLowerCase();
    if (base === 'de') return 'de';
    if (base === 'nb' || base === 'no') return 'nb';
    if (base === 'en') return 'en';
  }
  return 'en';
}

export const locale = signal<SupportedLocale>(detectLocale());

export function t(key: TranslationKey, params?: Record<string, string>): string {
  const loc = locale.get();
  let str = translations[loc][key] ?? translations['en'][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, v);
    }
  }
  return str;
}
