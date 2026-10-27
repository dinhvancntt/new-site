import { readFileSync } from 'node:fs';
import type { NextConfig } from 'next';

// Next chỉ đọc .env trong thư mục app, còn secret của dự án nằm ở gốc repo để
// worker dùng chung. Trên Vercel biến đã có sẵn nên vòng lặp này không chạy.
if (!process.env['DATABASE_URL']) {
  try {
    for (const line of readFileSync(new URL('../../.env', import.meta.url), 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      process.env[key] ??= trimmed.slice(eq + 1).trim();
    }
  } catch {
    // Không có .env thì dựa vào biến môi trường sẵn có.
  }
}

const config: NextConfig = {
  // Hai package workspace ship thẳng TypeScript nên Next phải tự biên dịch chúng.
  transpilePackages: ['@news/db', '@news/queries'],

  // Phải là 308 permanent: với 307 Google coi đây là tạm thời nên giữ URL cũ
  // lại trong index như URL riêng, báo trùng lặp và không dồn tín hiệu xếp
  // hạng sang đích. Tiếng Việt ngừng xuất bản 2026-10 nên `/vi` gộp về `/en`.
  //
  // Cố ý KHÔNG có luật bắt tất cả `/vi/:path*`: slug bài tiếng Việt khác slug
  // tiếng Anh, nên bài phải do route [lang]/[slug] tra `siblingSlug` trong DB
  // rồi mới chuyển hướng. Các luật dưới chỉ phủ đường dẫn cố định.
  async redirects() {
    const staticPages = ['about', 'archive', 'contact', 'policy', 'search', 'rss.xml'].map(
      (path) => ({ source: `/vi/${path}`, destination: `/en/${path}`, permanent: true }),
    );

    return [
      { source: '/', destination: '/en', permanent: true },
      { source: '/vi', destination: '/en', permanent: true },
      { source: '/vi/c/:category', destination: '/en/c/:category', permanent: true },
      ...staticPages,
    ];
  },
};

export default config;
