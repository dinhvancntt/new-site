import { listSitemapEntries } from '@news/queries';

import { getDb } from '@/lib/db';
import { DEFAULT_LANG } from '@/lib/lang';
import { buildSitemapXml } from '@/lib/sitemap';
import { CATEGORIES, siteUrl } from '@/lib/site';

export const revalidate = 300;

export async function GET() {
  const db = getDb();

  // Chỉ tiếng Anh: bản tiếng Việt ngừng xuất bản 2026-10 và mọi URL `/vi` giờ
  // chỉ 308, nên không đưa vào sitemap.
  const articles = await listSitemapEntries(db, DEFAULT_LANG, { limit: 2000 });

  const xml = buildSitemapXml({
    siteUrl: siteUrl(),
    categories: CATEGORIES,
    articles: articles.map((article) => ({
      slug: article.slug,
      publishedAt: article.publishedAt,
      imageUrl: article.imageUrl,
    })),
  });

  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}
