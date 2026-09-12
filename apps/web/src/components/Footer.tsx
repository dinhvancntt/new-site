import Link from 'next/link';
import { otherLang, type Lang } from '@/lib/lang';
import { NAV_CATEGORIES, CATEGORY_LABEL, SITE_NAME, STRINGS } from '@/lib/site';

export function Footer({ lang }: { lang: Lang }) {
  const t = STRINGS[lang];

  return (
    <footer className="mt-16 border-t-2 border-ink">
      <div className="mx-auto max-w-[1180px] px-5 py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="headline text-xl">{SITE_NAME}</p>
            <p className="slugline mt-2 max-w-[42ch] normal-case tracking-normal">{t.tagline}</p>
          </div>

          <ul className="slugline flex flex-wrap gap-x-5 gap-y-2">
            {NAV_CATEGORIES.map((category) => (
              <li key={category}>
                <Link href={`/${lang}/c/${category}`} className="link-rule">
                  {CATEGORY_LABEL[lang][category]}
                </Link>
              </li>
            ))}
            <li>
              <Link href={`/${lang}/rss.xml`} className="link-rule">
                RSS
              </Link>
            </li>
            <li>
              <Link href={`/${lang}/archive`} className="link-rule">
                {t.archive}
              </Link>
            </li>
            <li>
              <Link href={`/${lang}/about`} className="link-rule">
                {t.about}
              </Link>
            </li>
            <li>
              <Link href={`/${lang}/contact`} className="link-rule">
                {t.contact}
              </Link>
            </li>
            <li>
              <Link href={`/${lang}/policy`} className="link-rule">
                {t.policy}
              </Link>
            </li>
            <li>
              <Link href={`/${otherLang(lang)}`} className="link-rule">
                {t.otherLanguage}
              </Link>
            </li>
          </ul>
        </div>

        <p className="slugline mt-8 border-t border-rule pt-4 normal-case tracking-normal">
          <span className="text-wire">■</span> {t.aiNotice(lang === 'vi' ? 'các hãng tin' : 'wire services')}.
        </p>
      </div>
    </footer>
  );
}
