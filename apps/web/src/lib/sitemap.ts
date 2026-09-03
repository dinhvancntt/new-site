import type { Lang } from './lang';

export type SitemapArticle = {
  slug: string;
  publishedAt: Date;
};

export type SitemapInput = {
  siteUrl: string;
  categories: readonly string[];
  articlesByLang: Record<Lang, readonly SitemapArticle[]>;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(loc: string, priority: string, lastModified?: Date): string {
  const lines = [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    ...(lastModified ? [`    <lastmod>${lastModified.toISOString()}</lastmod>`] : []),
    `    <priority>${priority}</priority>`,
    '  </url>',
  ];
  return lines.join('\n');
}

/** Sitemap gộp cả hai ngôn ngữ, sinh trong route handler để ISR làm mới được. */
export function buildSitemapXml({ siteUrl, categories, articlesByLang }: SitemapInput): string {
  const origin = siteUrl.replace(/\/+$/, '');
  const entries: string[] = [];

  for (const lang of Object.keys(articlesByLang) as Lang[]) {
    entries.push(urlEntry(`${origin}/${lang}`, '1.0'));
    for (const category of categories) {
      entries.push(urlEntry(`${origin}/${lang}/c/${category}`, '0.7'));
    }
    for (const article of articlesByLang[lang]) {
      entries.push(urlEntry(`${origin}/${lang}/${article.slug}`, '0.5', article.publishedAt));
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}
