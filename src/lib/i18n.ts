import { page } from '$app/state';
import { de } from './de';

export const LANGS = ['en', 'de'] as const;
export type Lang = (typeof LANGS)[number];
export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

/** Intl locale per language. English uses en-GB: 24 h clock, day-first dates. */
export const LOCALES: Record<Lang, string> = { en: 'en-GB', de: 'de-DE' };

/**
 * Translates an English source string. English is the key itself, so only the German
 * dictionary (`./de.ts`) exists; a missing entry falls back to English.
 * `{name}` placeholders are filled from `params`.
 */
export function translate(lang: Lang, key: string, params?: Record<string, string | number>) {
	const text = (lang === 'de' && de[key]) || key;
	return params ? text.replace(/\{(\w+)\}/g, (m, k) => String(params[k] ?? m)) : text;
}

// Components call these without a language: it is read from the layout data, so a
// language switch re-renders everything. Server endpoints pass the language explicitly.
export const t = (key: string, params?: Record<string, string | number>) =>
	translate(page.data.lang, key, params);
export const locale = (lang: Lang = page.data.lang) => LOCALES[lang];
