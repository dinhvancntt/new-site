import Link from 'next/link';
import { SearchBox } from './SearchBox';
import { otherLang, type Lang } from '@/lib/lang';
import { CATEGORIES, CATEGORY_LABEL, SITE_NAME, STRINGS } from '@/lib/site';

export function Masthead({
  lang,
  activeCategory,
  otherLangHref,
  siteNameAs = 'span',
}: {
  lang: Lang;
  activeCategory?: string;
  /** Trang bài truyền slug của bản ngôn ngữ kia để nút chuyển giữ nguyên bài đang đọc. */
  otherLangHref?: string;
  /** Trang chủ dùng h1 cho tên báo; trang con dùng span để giữ một h1 duy nhất cho bài. */
  siteNameAs?: 'h1' | 'span';
}) {
  const t = STRINGS[lang];
  const SiteNameTag = siteNameAs;

  return (
    <header>
      <div className="border-b border-rule">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-2">
          <p className="slugline hidden sm:block">{t.tagline}</p>
          <div className="slugline flex items-center gap-3">
            <Link href={otherLangHref ?? `/${otherLang(lang)}`} className="link-rule text-ink">
              {t.otherLanguage}
            </Link>
            <span aria-hidden className="text-rule-strong">
              ·
            </span>
            <Link href={`/${lang}/rss.xml`} className="link-rule">
              RSS
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1180px] px-5">
        <div className="py-6 text-center sm:py-8">
          <Link href={`/${lang}`} className="inline-block">
            <SiteNameTag className="headline block text-[clamp(2rem,1.4rem+2.6vw,3.25rem)] tracking-[-0.025em]">
              {SITE_NAME}
            </SiteNameTag>
          </Link>
        </div>

        {/* Vạch wire: chỗ duy nhất trên trang được dùng màu đỏ, ngoài dòng công bố AI. */}
        <div className="border-t-2 border-wire" />

        <nav className="flex items-center justify-between gap-6 border-b border-rule py-2.5">
          <ul className="slugline -mb-px flex gap-5 overflow-x-auto whitespace-nowrap">
            {CATEGORIES.map((category) => {
              const active = category === activeCategory;
              return (
                <li key={category}>
                  <Link
                    href={`/${lang}/c/${category}`}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'border-b-2 border-ink pb-2 text-ink'
                        : 'link-rule pb-2 hover:text-ink'
                    }
                  >
                    {CATEGORY_LABEL[lang][category]}
                  </Link>
                </li>
              );
            })}
          </ul>

          <SearchBox lang={lang} />
        </nav>
      </div>
    </header>
  );
}
