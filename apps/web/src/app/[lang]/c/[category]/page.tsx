import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listByCategory } from '@news/queries';
import { Footer } from '@/components/Footer';
import { Masthead } from '@/components/Masthead';
import { River } from '@/components/River';
import { getDb } from '@/lib/db';
import { LANGS, parseLang } from '@/lib/lang';
import { CATEGORIES, CATEGORY_LABEL, STRINGS, isCategory } from '@/lib/site';

export const revalidate = 300;

export function generateStaticParams() {
  return LANGS.flatMap((lang) => CATEGORIES.map((category) => ({ lang, category })));
}

type Params = { params: Promise<{ lang: string; category: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang: rawLang, category } = await params;
  const lang = parseLang(rawLang);
  if (!lang || !isCategory(category)) return {};

  const label = CATEGORY_LABEL[lang][category];

  return {
    title: label,
    alternates: {
      canonical: `/${lang}/c/${category}`,
      languages: {
        vi: `/vi/c/${category}`,
        en: `/en/c/${category}`,
      },
    },
  };
}

export default async function CategoryPage({ params }: Params) {
  const { lang: rawLang, category } = await params;
  const lang = parseLang(rawLang);
  if (!lang || !isCategory(category)) notFound();

  const t = STRINGS[lang];
  const articles = await listByCategory(getDb(), lang, category, { limit: 40 });

  return (
    <>
      <Masthead lang={lang} activeCategory={category} />

      <main className="mx-auto max-w-[1180px] px-5">
        <h1 className="headline border-b-2 border-ink py-6 text-[length:var(--text-section)]">
          {CATEGORY_LABEL[lang][category]}
        </h1>

        <div className="pt-6">
          {articles.length > 0 ? (
            <River lang={lang} articles={articles} thumbsFor={3} showCategory={false} />
          ) : (
            <p className="py-24 text-center text-ink-soft">{t.noArticles}</p>
          )}
        </div>
      </main>

      <Footer lang={lang} />
    </>
  );
}
