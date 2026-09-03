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
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
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
    // 120 bài vi + 2 trang chủ + 4 chuyên mục
    expect(locs).toHaveLength(126);
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

  test('bỏ dấu / thừa ở cuối siteUrl', () => {
    const xml = buildSitemapXml({ ...base, siteUrl: 'https://example.com/' });
    expect(xml).toContain('<loc>https://example.com/vi</loc>');
    expect(xml).not.toContain('//vi</loc>');
  });
});
