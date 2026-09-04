/** robots.txt: mở cho crawler, chặn trang tìm kiếm, trỏ tới sitemap. */
export function buildRobotsTxt(siteUrl: string): string {
  const origin = siteUrl.replace(/\/+$/, '');

  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /*/search',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    `Sitemap: ${origin}/news-sitemap.xml`,
    '',
  ].join('\n');
}
