import { describe, expect, it } from 'vitest';

import { buildRobotsTxt } from './robots';

describe('buildRobotsTxt', () => {
  it('cho phép mọi crawler và trỏ tới sitemap', () => {
    const txt = buildRobotsTxt('https://example.com');

    expect(txt).toContain('User-agent: *');
    expect(txt).toContain('Allow: /');
    expect(txt).toContain('Sitemap: https://example.com/sitemap.xml');
  });

  it('bỏ dấu / thừa ở cuối siteUrl', () => {
    expect(buildRobotsTxt('https://example.com//')).toContain(
      'Sitemap: https://example.com/sitemap.xml',
    );
  });

  it('chặn trang tìm kiếm để tránh crawl trùng lặp', () => {
    expect(buildRobotsTxt('https://example.com')).toContain('Disallow: /*/search');
  });

  it('kết thúc bằng newline', () => {
    expect(buildRobotsTxt('https://example.com').endsWith('\n')).toBe(true);
  });
});
