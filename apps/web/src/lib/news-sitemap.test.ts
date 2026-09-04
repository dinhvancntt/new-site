import { describe, expect, test } from 'vitest';
import { buildNewsSitemapXml, filterNewsItems, type NewsSitemapItem } from './news-sitemap';

const now = new Date('2026-09-04T10:00:00.000Z');
const fresh: NewsSitemapItem = {
  lang: 'vi',
  slug: 'tin-moi',
  title: 'Tin mới & nóng',
  publishedAt: new Date('2026-09-04T09:00:00.000Z'),
};

describe('buildNewsSitemapXml', () => {
  test('khai báo namespace news của Google', () => {
    const xml = buildNewsSitemapXml({ siteUrl: 'https://example.com', siteName: 'Tin nhanh', items: [fresh] });
    expect(xml).toContain('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"');
  });

  test('mỗi URL có publication, publication_date và title', () => {
    const xml = buildNewsSitemapXml({ siteUrl: 'https://example.com', siteName: 'Tin nhanh', items: [fresh] });
    expect(xml).toContain('<loc>https://example.com/vi/tin-moi</loc>');
    expect(xml).toContain('<news:name>Tin nhanh</news:name>');
    expect(xml).toContain('<news:language>vi</news:language>');
    expect(xml).toContain('<news:publication_date>2026-09-04T09:00:00.000Z</news:publication_date>');
    expect(xml).toContain('<news:title>Tin mới &amp; nóng</news:title>');
  });
});

describe('filterNewsItems', () => {
  test('loại bài quá 48 giờ', () => {
    const old: NewsSitemapItem = { ...fresh, slug: 'tin-cu', publishedAt: new Date('2026-09-01T10:00:00.000Z') };
    expect(filterNewsItems([fresh, old], now).map((i) => i.slug)).toEqual(['tin-moi']);
  });

  test('giới hạn 1000 URL theo quy định Google News', () => {
    const many = Array.from({ length: 1005 }, (_, i) => ({ ...fresh, slug: `bai-${i}` }));
    expect(filterNewsItems(many, now)).toHaveLength(1000);
  });
});
