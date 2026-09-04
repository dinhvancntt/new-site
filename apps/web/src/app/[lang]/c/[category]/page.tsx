import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listByCategory } from '@news/queries';
import { Footer } from '@/components/Footer';
import { Masthead } from '@/components/Masthead';
import { River } from '@/components/River';
import { getDb } from '@/lib/db';
import { LANGS, parseLang } from '@/lib/lang';
import { CATEGORIES, CATEGORY_DESCRIPTION, CATEGORY_LABEL, SITE_NAME, STRINGS, hreflangAlternates, isCategory, siteUrl } from '@/lib/site';

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
  const title = lang === 'vi' ? `${label} — Tin ${label.toLowerCase()} quốc tế mới nhất` : `${label} — Latest international ${label.toLowerCase()} news`;
  const description = CATEGORY_DESCRIPTION[lang][category];

  return {
    title,
    description,
    alternates: {
      canonical: `/${lang}/c/${category}`,
      languages: hreflangAlternates(`/vi/c/${category}`, `/en/c/${category}`),
    },
    openGraph: {
      type: 'website',
      url: `/${lang}/c/${category}`,
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function CategoryPage({ params }: Params) {
  const { lang: rawLang, category } = await params;
  const lang = parseLang(rawLang);
  if (!lang || !isCategory(category)) notFound();

  const t = STRINGS[lang];
  const articles = await listByCategory(getDb(), lang, category, { limit: 40 });
  const origin = siteUrl().replace(/\/+$/, '');
  const label = CATEGORY_LABEL[lang][category];
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${origin}/${lang}` },
      { '@type': 'ListItem', position: 2, name: label, item: `${origin}/${lang}/c/${category}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Masthead lang={lang} activeCategory={category} />

      <main className="mx-auto max-w-[1180px] px-5">
        <h1 className="headline border-b-2 border-ink pt-6 pb-2 text-[length:var(--text-section)]">
          {CATEGORY_LABEL[lang][category]}
        </h1>
        <p className="max-w-[68ch] pt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
          {CATEGORY_DESCRIPTION[lang][category]}
        </p>

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
