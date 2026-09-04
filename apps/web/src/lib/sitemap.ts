import type { Lang } from './lang';

export type SitemapArticle = {
  slug: string;
  publishedAt: Date;
  /** Có articleId thì sitemap ghép được cặp vi–en để gắn hreflang. */
  articleId?: string;
  /** Ảnh gốc của bài, cho Google Images. */
  imageUrl?: string | null;
};

export type SitemapInput = {
  siteUrl: string;
  categories: readonly string[];
  articlesByLang: Record<Lang, readonly SitemapArticle[]>;
  /** Mốc lastmod cho trang chủ/mục (mặc định giờ hiện tại); bài viết dùng ngày đăng riêng. */
  generatedAt?: Date;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(
  loc: string,
  opts: {
    priority: string;
    lastModified?: Date;
    changefreq?: string;
    alternates?: { lang: Lang; href: string }[];
    image?: string | null;
  },
): string {
  const lines = [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    ...(opts.alternates ?? []).map(
      (alt) =>
        `    <xhtml:link rel="alternate" hreflang="${alt.lang}" href="${escapeXml(alt.href)}" />`,
    ),
    // Ảnh gốc (không qua proxy resize) để Google Images lập chỉ mục đúng nguồn.
    ...(opts.image ? [`    <image:image>`, `      <image:loc>${escapeXml(opts.image)}</image:loc>`, `    </image:image>`] : []),
    ...(opts.lastModified ? [`    <lastmod>${opts.lastModified.toISOString()}</lastmod>`] : []),
    ...(opts.changefreq ? [`    <changefreq>${opts.changefreq}</changefreq>`] : []),
    `    <priority>${opts.priority}</priority>`,
    '  </url>',
  ];
  return lines.join('\n');
}

/** Sitemap gộp cả hai ngôn ngữ, sinh trong route handler để ISR làm mới được. */
export function buildSitemapXml({ siteUrl, categories, articlesByLang, generatedAt = new Date() }: SitemapInput): string {
  const origin = siteUrl.replace(/\/+$/, '');
  const entries: string[] = [];
  const langs = Object.keys(articlesByLang) as Lang[];
  // Trang tĩnh minh bạch cho Google News / Publisher Center.
  const staticPaths = ['/about', '/contact', '/policy', '/archive'];

  // Ghép slug hai ngôn ngữ theo articleId để gắn hreflang cho từng bài.
  const slugsById = new Map<string, Partial<Record<Lang, string>>>();
  for (const lang of langs) {
    for (const article of articlesByLang[lang]) {
      if (!article.articleId) continue;
      let pair = slugsById.get(article.articleId);
      if (!pair) {
        pair = {};
        slugsById.set(article.articleId, pair);
      }
      pair[lang] = article.slug;
    }
  }

  for (const lang of langs) {
    const other = lang === 'vi' ? 'en' : 'vi';
    entries.push(
      urlEntry(`${origin}/${lang}`, {
        priority: '1.0',
        lastModified: generatedAt,
        changefreq: 'hourly',
        alternates: [
          { lang, href: `${origin}/${lang}` },
          { lang: other, href: `${origin}/${other}` },
        ],
      }),
    );
    for (const category of categories) {
      entries.push(
        urlEntry(`${origin}/${lang}/c/${category}`, {
          priority: '0.7',
          lastModified: generatedAt,
          changefreq: 'hourly',
          alternates: [
            { lang: 'vi', href: `${origin}/vi/c/${category}` },
            { lang: 'en', href: `${origin}/en/c/${category}` },
          ],
        }),
      );
    }
    for (const article of articlesByLang[lang]) {
      // Bài đã đăng nội dung cố định nên changefreq never.
      const pair = article.articleId ? slugsById.get(article.articleId) : undefined;
      entries.push(
        urlEntry(`${origin}/${lang}/${article.slug}`, {
          priority: '0.5',
          lastModified: article.publishedAt,
          changefreq: 'never',
          image: article.imageUrl,
          ...(pair?.vi && pair?.en
            ? {
                alternates: [
                  { lang: 'vi' as Lang, href: `${origin}/vi/${pair.vi}` },
                  { lang: 'en' as Lang, href: `${origin}/en/${pair.en}` },
                ],
              }
            : {}),
        }),
      );
    }
    for (const page of staticPaths) {
      entries.push(
        urlEntry(`${origin}/${lang}${page}`, {
          priority: '0.3',
          changefreq: 'monthly',
          alternates: [
            { lang: 'vi', href: `${origin}/vi${page}` },
            { lang: 'en', href: `${origin}/en${page}` },
          ],
        }),
      );
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}
