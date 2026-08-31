import type { Lang } from '@/lib/lang';
import { STRINGS } from '@/lib/site';

/** Form GET thuần, không cần JavaScript. */
export function SearchBox({
  lang,
  defaultValue = '',
  size = 'compact',
}: {
  lang: Lang;
  defaultValue?: string;
  size?: 'compact' | 'full';
}) {
  const t = STRINGS[lang];

  return (
    <form action={`/${lang}/search`} className="flex shrink-0 items-center gap-2">
      <label htmlFor={`q-${size}`} className="sr-only">
        {t.searchLabel}
      </label>
      <input
        id={`q-${size}`}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={t.searchPlaceholder}
        autoComplete="off"
        className={`${
          size === 'full' ? 'w-full text-base' : 'w-28 text-xs sm:w-40'
        } border-b border-rule bg-transparent pb-1 font-mono text-ink placeholder:text-ink-soft/70 focus:border-ink focus:outline-none`}
      />
      <button type="submit" className="slugline link-rule shrink-0 text-ink">
        {t.searchAction}
      </button>
    </form>
  );
}
