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

  // `/` không có nội dung riêng; 307 để sau này còn đổi được sang dò ngôn ngữ.
  async redirects() {
    return [{ source: '/', destination: '/vi', permanent: false }];
  },
};

export default config;
