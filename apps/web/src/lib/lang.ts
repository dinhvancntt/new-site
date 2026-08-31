export type Lang = 'vi' | 'en';

export const LANGS: readonly Lang[] = ['vi', 'en'];

/** `lang` chỉ nhận `vi` hoặc `en`; giá trị khác trả 404. */
export function parseLang(value: string | undefined): Lang | null {
  return value === 'vi' || value === 'en' ? value : null;
}

export function otherLang(lang: Lang): Lang {
  return lang === 'vi' ? 'en' : 'vi';
}
