import { describe, expect, test } from 'vitest';
import { buildSitemapXml } from './sitemap';

const base = {
  siteUrl: 'https://example.com',
  categories: ['world', 'business'] as const,
  articles: [{ slug: 'latest-news', publishedAt: new Date('2026-09-03T04:00:00.000Z') }],
};

describe('buildSitemapXml', () => {
  test('mở đầu bằng khai báo XML và urlset', () => {
    const xml = buildSitemapXml(base);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
  });

  test('có trang chủ và chuyên mục', () => {
    const xml = buildSitemapXml(base);
    expect(xml).toContain('<loc>https://example.com/en</loc>');
    expect(xml).toContain('<loc>https://example.com/en/c/world</loc>');
    expect(xml).toContain('<loc>https://example.com/en/c/business</loc>');
  });

  test('có URL bài viết kèm lastmod', () => {
    const xml = buildSitemapXml(base);
    expect(xml).toContain('<loc>https://example.com/en/latest-news</loc>');
    expect(xml).toContain('<lastmod>2026-09-03T04:00:00.000Z</lastmod>');
  });

  test('không liệt kê URL tiếng Việt đã ngừng', () => {
    // Sitemap là lời mời thu thập. Liệt kê URL chỉ để 308 sẽ đốt crawl budget
    // và khiến Google báo "Trang có chuyển hướng" trong Search Console.
    const xml = buildSitemapXml(base);
    expect(xml).not.toContain('https://example.com/vi');
  });

  test('không còn hreflang vì site chỉ còn một ngôn ngữ', () => {
    const xml = buildSitemapXml(base);
    expect(xml).not.toContain('hreflang');
    expect(xml).not.toContain('xhtml');
  });

  test('không bỏ sót bài nào — mọi bài đều có mặt', () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      slug: `bai-${i}`,
      publishedAt: new Date('2026-09-03T04:00:00.000Z'),
    }));
    const xml = buildSitemapXml({ ...base, articles: many });
    const locs = xml.match(/<loc>/g) ?? [];
    // 120 bài + 1 trang chủ + 2 chuyên mục + 4 trang tĩnh (about/contact/policy/archive)
    expect(locs).toHaveLength(127);
    expect(xml).toContain('<loc>https://example.com/en/bai-119</loc>');
  });

  test('escape ký tự đặc biệt trong slug', () => {
    const xml = buildSitemapXml({
      ...base,
      articles: [{ slug: 'a&b', publishedAt: new Date(0) }],
    });
    expect(xml).toContain('<loc>https://example.com/en/a&amp;b</loc>');
    expect(xml).not.toContain('<loc>https://example.com/en/a&b</loc>');
  });

  test('trang chủ và chuyên mục có changefreq', () => {
    expect(buildSitemapXml(base)).toContain('<changefreq>hourly</changefreq>');
  });

  test('bài có ảnh gốc được gắn image:image cho Google Images', () => {
    const xml = buildSitemapXml({
      ...base,
      articles: [
        {
          slug: 'latest-news',
          publishedAt: new Date('2026-09-03T04:00:00.000Z'),
          imageUrl: 'https://cdn.example.com/photo.jpg',
        },
      ],
    });
    expect(xml).toContain('<image:loc>https://cdn.example.com/photo.jpg</image:loc>');
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
  });

  test('bỏ dấu / thừa ở cuối siteUrl', () => {
    expect(buildSitemapXml({ ...base, siteUrl: 'https://example.com/' })).not.toContain(
      '//en</loc>',
    );
  });
});
