import { listLatest } from '@news/queries';

import { getDb } from '@/lib/db';
import { buildSitemapXml } from '@/lib/sitemap';
import { CATEGORIES, siteUrl } from '@/lib/site';

export const revalidate = 300;

export async function GET() {
  const db = getDb();

  const [vi, en] = await Promise.all([
    listLatest(db, 'vi', { limit: 2000 }),
    listLatest(db, 'en', { limit: 2000 }),
  ]);

  const toEntries = (articles: Awaited<ReturnType<typeof listLatest>>) =>
    articles.map((article) => ({ slug: article.slug, publishedAt: article.publishedAt }));

  const xml = buildSitemapXml({
    siteUrl: siteUrl(),
    categories: CATEGORIES,
    articlesByLang: { vi: toEntries(vi), en: toEntries(en) },
  });

  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}
