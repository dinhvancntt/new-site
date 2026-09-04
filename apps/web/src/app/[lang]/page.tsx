import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listLatest } from '@news/queries';
import { Footer } from '@/components/Footer';
import { LeadStory } from '@/components/LeadStory';
import { Masthead } from '@/components/Masthead';
import { River } from '@/components/River';
import { getDb } from '@/lib/db';
import { LANGS, parseLang } from '@/lib/lang';
import { SITE_DESCRIPTION, SITE_NAME, STRINGS, hreflangAlternates, siteUrl } from '@/lib/site';

export const revalidate = 300;

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = parseLang((await params).lang);
  if (!lang) return {};
  const title = lang === 'vi' ? `${SITE_NAME} — Tin quốc tế tổng hợp và tóm lược 24/7` : `${SITE_NAME} — World news gathered and summarised 24/7`;

  return {
    title,
    description: SITE_DESCRIPTION[lang],
    alternates: {
      canonical: `/${lang}`,
      languages: hreflangAlternates('/vi', '/en'),
    },
    openGraph: {
      type: 'website',
      url: `/${lang}`,
      title,
      description: SITE_DESCRIPTION[lang],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: SITE_DESCRIPTION[lang],
    },
  };
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = parseLang((await params).lang);
  if (!lang) notFound();

  const t = STRINGS[lang];
  const articles = await listLatest(getDb(), lang, { limit: 25 });
  const [lead, ...rest] = articles;
  const origin = siteUrl().replace(/\/+$/, '');
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: lang === 'vi' ? `${SITE_NAME} — Tin quốc tế tổng hợp và tóm lược 24/7` : `${SITE_NAME} — World news gathered and summarised 24/7`,
    description: SITE_DESCRIPTION[lang],
    url: `${origin}/${lang}`,
    inLanguage: lang,
    ...(lead
      ? {
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: articles.slice(0, 10).map((a, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `${origin}/${lang}/${a.slug}`,
              name: a.title,
            })),
          },
        }
      : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <Masthead lang={lang} siteNameAs="h1" />

      <main className="mx-auto max-w-[1180px] px-5">
        {lead ? (
          <>
            <div className="py-8">
              <LeadStory lang={lang} article={lead} />
            </div>

            <h2 className="slugline mb-5 border-b-2 border-ink pb-2 text-ink">{t.latest}</h2>

            <River lang={lang} articles={rest} thumbsFor={3} />

            <p className="slugline py-6 text-center">
              <Link href={`/${lang}/archive`} className="link-rule text-ink">
                {t.viewAll} →
              </Link>
            </p>
          </>
        ) : (
          <p className="py-24 text-center text-ink-soft">{t.noArticles}</p>
        )}
      </main>

      <Footer lang={lang} />
    </>
  );
}
