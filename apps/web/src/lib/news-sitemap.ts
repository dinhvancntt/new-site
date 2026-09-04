import type { Lang } from './lang';

export type NewsSitemapItem = {
  lang: Lang;
  slug: string;
  title: string;
  publishedAt: Date;
};

export type NewsSitemapInput = {
  siteUrl: string;
  siteName: string;
  items: readonly NewsSitemapItem[];
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * News sitemap cho Google News: chỉ nhận bài trong 2 ngày gần nhất, tối đa
 * 1000 URL. `news:title` phải khớp tiêu đề trên trang bài — ở đây cùng một
 * nguồn title nên luôn khớp.
 */
export function buildNewsSitemapXml({ siteUrl, siteName, items }: NewsSitemapInput): string {
  const origin = siteUrl.replace(/\/+$/, '');

  const entries = items.map((item) => {
    const loc = `${origin}/${item.lang}/${item.slug}`;
    return [
      '  <url>',
      `    <loc>${escapeXml(loc)}</loc>`,
      '    <news:news>',
      '      <news:publication>',
      `        <news:name>${escapeXml(siteName)}</news:name>`,
      `        <news:language>${item.lang}</news:language>`,
      '      </news:publication>',
      `      <news:publication_date>${item.publishedAt.toISOString()}</news:publication_date>`,
      `      <news:title>${escapeXml(item.title)}</news:title>`,
      '    </news:news>',
      '  </url>',
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}

/** Lọc bài đủ điều kiện vào news sitemap: mới hơn `maxAgeHours`, tối đa `limit` bài. */
export function filterNewsItems(
  items: readonly NewsSitemapItem[],
  now: Date,
  maxAgeHours = 48,
  limit = 1000,
): NewsSitemapItem[] {
  const cutoff = now.getTime() - maxAgeHours * 3600 * 1000;
  return items.filter((item) => item.publishedAt.getTime() >= cutoff).slice(0, limit);
}
