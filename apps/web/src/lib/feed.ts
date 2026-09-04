import type { Lang } from './lang';

export type FeedItem = {
  slug: string;
  title: string;
  summary: string;
  publishedAt: Date;
  imageUrl?: string | null;
};

export type FeedInput = {
  siteUrl: string;
  lang: Lang;
  items: readonly FeedItem[];
  /** Mốc lastBuildDate của kênh (mặc định giờ hiện tại). */
  buildDate?: Date;
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

/** Suy ra MIME từ đuôi đường dẫn: ảnh nguồn hay kèm query string nên phải cắt trước khi đọc đuôi. */
function imageMimeType(url: string): string {
  const path = url.split(/[?#]/)[0] ?? '';
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

export function buildRssXml({ siteUrl, lang, items, buildDate = new Date() }: FeedInput): string {
  const origin = siteUrl.replace(/\/+$/, '');
  const home = `${origin}/${lang}`;

  const entries = items
    .map((item) => {
      const url = `${home}/${item.slug}`;
      const lines = [
        '    <item>',
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <description>${escapeXml(item.summary)}</description>`,
        `      <pubDate>${item.publishedAt.toUTCString()}</pubDate>`,
      ];

      // RSS 2.0 bắt buộc có length; biết số byte thật thì phải tải ảnh về nên để 0 —
      // dlvr.it và các reader đều chấp nhận.
      if (item.imageUrl) {
        lines.push(
          `      <enclosure url="${escapeXml(item.imageUrl)}" type="${imageMimeType(item.imageUrl)}" length="0"/>`,
        );
      }

      lines.push('    </item>');
      return lines.join('\n');
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
    `    <lastBuildDate>${buildDate.toUTCString()}</lastBuildDate>`,
    // Gợi ý reader quay lại mỗi 15 phút, khớp nhịp ingest tin mới.
    '    <ttl>15</ttl>',
    `    <atom:link href="${escapeXml(`${home}/rss.xml`)}" rel="self" type="application/rss+xml"/>`,
    entries,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}
