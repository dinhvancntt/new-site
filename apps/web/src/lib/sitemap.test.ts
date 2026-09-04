import { describe, expect, test } from 'vitest';
import { buildSitemapXml } from './sitemap';

const base = {
  siteUrl: 'https://example.com',
  categories: ['world', 'business'] as const,
  articlesByLang: {
    vi: [{ slug: 'tin-moi-nhat', publishedAt: new Date('2026-09-03T04:00:00.000Z') }],
    en: [{ slug: 'latest-news', publishedAt: new Date('2026-09-03T04:00:00.000Z') }],
  },
};

describe('buildSitemapXml', () => {
  test('mở đầu bằng khai báo XML và urlset', () => {
    const xml = buildSitemapXml(base);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
  });

  test('có trang chủ và chuyên mục cho cả hai ngôn ngữ', () => {
    const xml = buildSitemapXml(base);
    for (const lang of ['vi', 'en']) {
      expect(xml).toContain(`<loc>https://example.com/${lang}</loc>`);
      expect(xml).toContain(`<loc>https://example.com/${lang}/c/world</loc>`);
      expect(xml).toContain(`<loc>https://example.com/${lang}/c/business</loc>`);
    }
  });

  test('có URL bài viết theo từng ngôn ngữ kèm lastmod', () => {
    const xml = buildSitemapXml(base);
    expect(xml).toContain('<loc>https://example.com/vi/tin-moi-nhat</loc>');
    expect(xml).toContain('<loc>https://example.com/en/latest-news</loc>');
    expect(xml).toContain('<lastmod>2026-09-03T04:00:00.000Z</lastmod>');
  });

  test('không bỏ sót bài nào — mọi bài đều có mặt', () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      slug: `bai-${i}`,
      publishedAt: new Date('2026-09-03T04:00:00.000Z'),
    }));
    const xml = buildSitemapXml({ ...base, articlesByLang: { vi: many, en: [] } });
    const locs = xml.match(/<loc>/g) ?? [];
    // 120 bài vi + 2 trang chủ + 4 chuyên mục + 8 trang tĩnh (about/contact/policy/archive x2 ngôn ngữ)
    expect(locs).toHaveLength(134);
    expect(xml).toContain('<loc>https://example.com/vi/bai-119</loc>');
  });

  test('escape ký tự đặc biệt trong slug', () => {
    const xml = buildSitemapXml({
      ...base,
      articlesByLang: { vi: [{ slug: 'a&b', publishedAt: new Date(0) }], en: [] },
    });
    expect(xml).toContain('<loc>https://example.com/vi/a&amp;b</loc>');
    expect(xml).not.toContain('<loc>https://example.com/vi/a&b</loc>');
  });

  test('trang chủ và chuyên mục có hreflang và changefreq', () => {
    const xml = buildSitemapXml(base);
    expect(xml).toContain('hreflang="vi" href="https://example.com/vi"');
    expect(xml).toContain('hreflang="en" href="https://example.com/en/c/world"');
    expect(xml).toContain('<changefreq>hourly</changefreq>');
  });

  test('bài có ảnh gốc được gắn image:image cho Google Images', () => {
    const xml = buildNewsAwareXml();
    expect(xml).toContain('<image:loc>https://cdn.example.com/photo.jpg</image:loc>');
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
  });

  test('cặp bài cùng articleId trỏ hreflang về nhau', () => {
    const xml = buildNewsAwareXml();
    expect(xml).toContain('hreflang="vi" href="https://example.com/vi/tin-moi-nhat"');
    expect(xml).toContain('hreflang="en" href="https://example.com/en/latest-news"');
  });

  test('bài không có cặp thì không gắn hreflang thừa', () => {
    const xml = buildSitemapXml({
      ...base,
      articlesByLang: { vi: [{ slug: 'bai-le', publishedAt: new Date('2026-09-03T04:00:00.000Z') }], en: [] },
    });
    expect(xml).toContain('<loc>https://example.com/vi/bai-le</loc>');
    expect(xml).not.toContain('href="https://example.com/vi/bai-le"');
  });

  test('bỏ dấu / thừa ở cuối siteUrl', () => {
    expect(buildSitemapXml({ ...base, siteUrl: 'https://example.com/' })).not.toContain('//vi</loc>');
  });
});

/** Fixture có articleId chung để kiểm tra ghép cặp và ảnh. */
function buildNewsAwareXml(): string {
  const at = new Date('2026-09-03T04:00:00.000Z');
  return buildSitemapXml({
    siteUrl: 'https://example.com',
    categories: [],
    articlesByLang: {
      vi: [{ slug: 'tin-moi-nhat', publishedAt: at, articleId: 'a1', imageUrl: 'https://cdn.example.com/photo.jpg' }],
      en: [{ slug: 'latest-news', publishedAt: at, articleId: 'a1' }],
    },
  });
}
