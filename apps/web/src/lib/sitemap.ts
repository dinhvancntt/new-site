import { DEFAULT_LANG } from './lang';

export type SitemapArticle = {
  slug: string;
  publishedAt: Date;
  /** Ảnh gốc của bài, cho Google Images. */
  imageUrl?: string | null;
};

export type SitemapInput = {
  siteUrl: string;
  categories: readonly string[];
  articles: readonly SitemapArticle[];
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
    image?: string | null;
  },
): string {
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    // Ảnh gốc (không qua proxy resize) để Google Images lập chỉ mục đúng nguồn.
    ...(opts.image
      ? [
          `    <image:image>`,
          `      <image:loc>${escapeXml(opts.image)}</image:loc>`,
          `    </image:image>`,
        ]
      : []),
    ...(opts.lastModified ? [`    <lastmod>${opts.lastModified.toISOString()}</lastmod>`] : []),
    ...(opts.changefreq ? [`    <changefreq>${opts.changefreq}</changefreq>`] : []),
    `    <priority>${opts.priority}</priority>`,
    '  </url>',
  ].join('\n');
}

/**
 * Sitemap một ngôn ngữ, sinh trong route handler để ISR làm mới được.
 *
 * Không còn hreflang: site chỉ xuất bản tiếng Anh từ 2026-10, và URL `/vi` cũ
 * chỉ tồn tại để 308 nên cố ý không liệt kê — sitemap là lời mời thu thập,
 * đưa URL chuyển hướng vào chỉ tổ đốt crawl budget.
 */
export function buildSitemapXml({
  siteUrl,
  categories,
  articles,
  generatedAt = new Date(),
}: SitemapInput): string {
  const origin = siteUrl.replace(/\/+$/, '');
  const lang = DEFAULT_LANG;
  const entries: string[] = [];
  // Trang tĩnh minh bạch cho Google News / Publisher Center.
  const staticPaths = ['/about', '/contact', '/policy', '/archive'];

  entries.push(
    urlEntry(`${origin}/${lang}`, {
      priority: '1.0',
      lastModified: generatedAt,
      changefreq: 'hourly',
    }),
  );

  for (const category of categories) {
    entries.push(
      urlEntry(`${origin}/${lang}/c/${category}`, {
        priority: '0.7',
        lastModified: generatedAt,
        changefreq: 'hourly',
      }),
    );
  }

  for (const article of articles) {
    // Bài đã đăng nội dung cố định nên changefreq never.
    entries.push(
      urlEntry(`${origin}/${lang}/${article.slug}`, {
        priority: '0.5',
        lastModified: article.publishedAt,
        changefreq: 'never',
        image: article.imageUrl,
      }),
    );
  }

  for (const page of staticPaths) {
    entries.push(
      urlEntry(`${origin}/${lang}${page}`, { priority: '0.3', changefreq: 'monthly' }),
    );
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}
