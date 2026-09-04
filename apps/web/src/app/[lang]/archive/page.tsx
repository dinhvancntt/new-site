import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listLatest } from '@news/queries';
import { Footer } from '@/components/Footer';
import { Masthead } from '@/components/Masthead';
import { River } from '@/components/River';
import { getDb } from '@/lib/db';
import { LANGS, parseLang } from '@/lib/lang';
import { STRINGS, hreflangAlternates } from '@/lib/site';

export const revalidate = 300;

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

const PAGE_SIZE = 20;

type Params = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

function parsePage(raw: string | string[] | undefined): number {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(first ?? '', 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const lang = parseLang((await params).lang);
  if (!lang) return {};
  const page = parsePage((await searchParams).page);
  const title =
    page > 1
      ? `${STRINGS[lang].archive} — ${lang === 'vi' ? `Trang ${page}` : `Page ${page}`}`
      : STRINGS[lang].archive;
  const description =
    lang === 'vi'
      ? 'Toàn bộ kho tin quốc tế đã đăng: duyệt theo thời gian, không bỏ sót bài nào.'
      : 'The full archive of published world news, browsable by date.';
  const canonical = page > 1 ? `/${lang}/archive?page=${page}` : `/${lang}/archive`;

  return {
    title,
    description,
    alternates: { canonical, languages: hreflangAlternates('/vi/archive', '/en/archive') },
    openGraph: { type: 'website', url: canonical, title, description },
    // Trang 2+ chỉ để crawler lần theo link, không cần lên kết quả tìm kiếm.
    ...(page > 1 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ArchivePage({ params, searchParams }: Params) {
  const lang = parseLang((await params).lang);
  if (!lang) notFound();
  const page = parsePage((await searchParams).page);

  const t = STRINGS[lang];
  const rows = await listLatest(getDb(), lang, { limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE });
  const articles = rows.slice(0, PAGE_SIZE);
  const hasNext = rows.length > PAGE_SIZE;

  const pageHref = (p: number) => (p <= 1 ? `/${lang}/archive` : `/${lang}/archive?page=${p}`);

  return (
    <>
      <Masthead lang={lang} />

      <main className="mx-auto max-w-[1180px] px-5">
        <h1 className="headline border-b-2 border-ink py-6 text-[length:var(--text-section)]">
          {t.archive}
          {page > 1 ? ` — ${page}` : ''}
        </h1>

        <div className="pt-6">
          {articles.length > 0 ? (
            <River lang={lang} articles={articles} thumbsFor={0} />
          ) : (
            <p className="py-24 text-center text-ink-soft">{t.noArticles}</p>
          )}
        </div>

        <nav aria-label="Pagination" className="slugline flex items-center justify-between border-t border-rule py-6">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="link-rule text-ink">
              {t.newerPage}
            </Link>
          ) : (
            <span />
          )}
          {hasNext ? (
            <Link href={pageHref(page + 1)} rel="next" className="link-rule text-ink">
              {t.olderPage}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </main>

      <Footer lang={lang} />
    </>
  );
}
