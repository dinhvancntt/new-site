import type { Lang } from './lang';

export type FeedItem = {
  slug: string;
  title: string;
  summary: string;
  publishedAt: Date;
};

export type FeedInput = {
  siteUrl: string;
  lang: Lang;
  items: readonly FeedItem[];
};

const CHANNEL_TITLE: Record<Lang, string> = {
  vi: 'Tin nhanh',
  en: 'Tin nhanh — English',
};

const CHANNEL_DESCRIPTION: Record<Lang, string> = {
  vi: 'Tin quốc tế tổng hợp và tóm lược tự động.',
  en: 'World news, automatically summarised.',
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildRssXml({ siteUrl, lang, items }: FeedInput): string {
  const origin = siteUrl.replace(/\/+$/, '');
  const home = `${origin}/${lang}`;

  const entries = items
    .map((item) => {
      const url = `${home}/${item.slug}`;
      return [
        '    <item>',
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <description>${escapeXml(item.summary)}</description>`,
        `      <pubDate>${item.publishedAt.toUTCString()}</pubDate>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(CHANNEL_TITLE[lang])}</title>`,
    `    <link>${escapeXml(home)}</link>`,
    `    <description>${escapeXml(CHANNEL_DESCRIPTION[lang])}</description>`,
    `    <language>${lang}</language>`,
    `    <atom:link href="${escapeXml(`${home}/rss.xml`)}" rel="self" type="application/rss+xml"/>`,
    entries,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}
