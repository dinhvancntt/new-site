import { listLatest } from '@news/queries';

import { getDb } from '@/lib/db';
import { LANGS } from '@/lib/lang';
import { buildNewsSitemapXml, filterNewsItems } from '@/lib/news-sitemap';
import { SITE_NAME, siteUrl } from '@/lib/site';

// Tin mới liên tục nên làm mới 5 phút một lần như trang chủ.
export const revalidate = 300;

export async function GET() {
  const db = getDb();

  // Chỉ ngôn ngữ còn xuất bản: URL của ngôn ngữ đã ngừng nay 308, mà sitemap
  // chứa URL chuyển hướng thì Google News bỏ qua cả mục đó.
  const perLang = await Promise.all(
    LANGS.map(async (lang) => {
      const rows = await listLatest(db, lang, { limit: 1000 });
      return rows.map((a) => ({ lang, slug: a.slug, title: a.title, publishedAt: a.publishedAt }));
    }),
  );

  const items = perLang.flat();

  const xml = buildNewsSitemapXml({
    siteUrl: siteUrl(),
    siteName: SITE_NAME,
    items: filterNewsItems(items, new Date()),
  });

  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}
