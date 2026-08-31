import { expect, test } from 'vitest';
import { buildRssXml } from './feed';

const item = {
  slug: 'gia-vang-tang-manh',
  title: 'Giá vàng tăng mạnh',
  summary: 'Thị trường phản ứng sau phiên họp.',
  publishedAt: new Date('2026-08-30T04:15:00.000Z'),
};

test('wraps items in a channel that points back at the language home', () => {
  const xml = buildRssXml({ siteUrl: 'https://tin.example.com', lang: 'vi', items: [item] });

  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  expect(xml).toContain('<link>https://tin.example.com/vi</link>');
  expect(xml).toContain('<atom:link href="https://tin.example.com/vi/rss.xml" rel="self"');
});

test('gives every item an absolute link and a stable guid', () => {
  const xml = buildRssXml({ siteUrl: 'https://tin.example.com', lang: 'vi', items: [item] });

  expect(xml).toContain('<link>https://tin.example.com/vi/gia-vang-tang-manh</link>');
  expect(xml).toContain(
    '<guid isPermaLink="true">https://tin.example.com/vi/gia-vang-tang-manh</guid>',
  );
});

test('emits pubDate in RFC 822 as RSS readers expect', () => {
  const xml = buildRssXml({ siteUrl: 'https://tin.example.com', lang: 'vi', items: [item] });

  expect(xml).toContain('<pubDate>Sun, 30 Aug 2026 04:15:00 GMT</pubDate>');
});

test('escapes markup characters instead of producing broken XML', () => {
  const xml = buildRssXml({
    siteUrl: 'https://tin.example.com',
    lang: 'en',
    items: [{ ...item, title: 'Fish & <chips>', summary: 'He said "no" & left' }],
  });

  expect(xml).toContain('<title>Fish &amp; &lt;chips&gt;</title>');
  expect(xml).toContain('He said &quot;no&quot; &amp; left');
  expect(xml).not.toContain('<chips>');
});

test('trailing slash on the site url does not double up in links', () => {
  const xml = buildRssXml({ siteUrl: 'https://tin.example.com/', lang: 'vi', items: [item] });

  expect(xml).not.toContain('//vi');
});
