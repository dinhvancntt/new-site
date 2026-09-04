import { listLatest } from '@news/queries';

import { getDb } from '@/lib/db';
import { buildNewsSitemapXml, filterNewsItems } from '@/lib/news-sitemap';
import { SITE_NAME, siteUrl } from '@/lib/site';

// Tin mới liên tục nên làm mới 5 phút một lần như trang chủ.
export const revalidate = 300;

export async function GET() {
  const db = getDb();

  const [vi, en] = await Promise.all([
    listLatest(db, 'vi', { limit: 1000 }),
    listLatest(db, 'en', { limit: 1000 }),
  ]);

  const items = [
    ...vi.map((a) => ({ lang: 'vi' as const, slug: a.slug, title: a.title, publishedAt: a.publishedAt })),
    ...en.map((a) => ({ lang: 'en' as const, slug: a.slug, title: a.title, publishedAt: a.publishedAt })),
  ];

  const xml = buildNewsSitemapXml({
    siteUrl: siteUrl(),
    siteName: SITE_NAME,
    items: filterNewsItems(items, new Date()),
  });

  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}
