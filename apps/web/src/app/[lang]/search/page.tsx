import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { searchArticles } from '@news/queries';
import { Footer } from '@/components/Footer';
import { Masthead } from '@/components/Masthead';
import { River } from '@/components/River';
import { SearchBox } from '@/components/SearchBox';
import { getDb } from '@/lib/db';
import { parseLang } from '@/lib/lang';
import { STRINGS } from '@/lib/site';

// Phụ thuộc query string nên luôn render động; không cache.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const lang = parseLang((await params).lang);
  if (!lang) notFound();

  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
  const t = STRINGS[lang];

  const results = query ? await searchArticles(getDb(), lang, query, { limit: 40 }) : [];

  return (
    <>
      <Masthead lang={lang} />

      <main className="mx-auto max-w-[1180px] px-5">
        <div className="border-b-2 border-ink py-6">
          <h1 className="headline text-[length:var(--text-section)]">
            {query ? t.searchHeading(query) : t.searchLabel}
          </h1>

          <div className="mt-5 max-w-md">
            <SearchBox lang={lang} defaultValue={query} size="full" />
          </div>
        </div>

        <div className="pt-6">
          {!query ? (
            <p className="py-20 text-center text-ink-soft">{t.searchPrompt}</p>
          ) : results.length > 0 ? (
            <>
              <p className="slugline mb-5">{t.searchCount(results.length)}</p>
              <River lang={lang} articles={results} />
            </>
          ) : (
            <p className="py-20 text-center text-ink-soft">{t.searchEmpty}</p>
          )}
        </div>
      </main>

      <Footer lang={lang} />
    </>
  );
}
