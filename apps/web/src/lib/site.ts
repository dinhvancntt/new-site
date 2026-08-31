import type { Lang } from './lang';

export const SITE_NAME = 'Tin nhanh';

/** Cùng danh sách chuyên mục mà worker thu thập (packages/ingest CATEGORIES). */
export const CATEGORIES = ['world', 'business', 'technology', 'sports', 'health'] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

/** RSS và sitemap cần URL tuyệt đối; Vercel cấp sẵn VERCEL_PROJECT_PRODUCTION_URL. */
export function siteUrl(): string {
  const explicit = process.env['NEXT_PUBLIC_SITE_URL'];
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercel = process.env['VERCEL_PROJECT_PRODUCTION_URL'];
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}

export const CATEGORY_LABEL: Record<Lang, Record<Category, string>> = {
  vi: {
    world: 'Thế giới',
    business: 'Kinh doanh',
    technology: 'Công nghệ',
    sports: 'Thể thao',
    health: 'Sức khoẻ',
  },
  en: {
    world: 'World',
    business: 'Business',
    technology: 'Technology',
    sports: 'Sports',
    health: 'Health',
  },
};

export function categoryLabel(lang: Lang, category: string): string {
  return isCategory(category) ? CATEGORY_LABEL[lang][category] : category;
}

type Strings = {
  tagline: string;
  latest: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchAction: string;
  searchHeading: (query: string) => string;
  searchCount: (count: number) => string;
  searchEmpty: string;
  searchPrompt: string;
  readOriginal: string;
  aiNotice: (source: string) => string;
  publishedAt: string;
  otherLanguage: string;
  notFoundTitle: string;
  notFoundBody: string;
  backHome: string;
  noArticles: string;
};

export const STRINGS: Record<Lang, Strings> = {
  vi: {
    tagline: 'Tin quốc tế, tổng hợp và tóm lược tự động',
    latest: 'Mới nhất',
    searchLabel: 'Tìm tin',
    searchPlaceholder: 'Tìm tin…',
    searchAction: 'Tìm',
    searchHeading: (query) => `Kết quả cho “${query}”`,
    searchCount: (count) => `${count} bài`,
    searchEmpty: 'Không tìm thấy bài nào khớp.',
    searchPrompt: 'Nhập từ khoá để tìm trong kho tin. Gõ không dấu vẫn ra kết quả.',
    readOriginal: 'Đọc bản gốc',
    aiNotice: (source) => `Nội dung được tóm lược tự động bằng AI từ ${source}`,
    publishedAt: 'Đăng lúc',
    otherLanguage: 'English',
    notFoundTitle: 'Không có trang này',
    notFoundBody: 'Đường dẫn bạn mở không tồn tại hoặc bài đã bị gỡ.',
    backHome: 'Về trang chủ',
    noArticles: 'Chưa có bài nào trong mục này.',
  },
  en: {
    tagline: 'World news, gathered and summarised automatically',
    latest: 'Latest',
    searchLabel: 'Search',
    searchPlaceholder: 'Search news…',
    searchAction: 'Search',
    searchHeading: (query) => `Results for “${query}”`,
    searchCount: (count) => (count === 1 ? '1 article' : `${count} articles`),
    searchEmpty: 'Nothing matched that search.',
    searchPrompt: 'Type a keyword to search the archive.',
    readOriginal: 'Read the original',
    aiNotice: (source) => `Automatically summarised by AI from ${source}`,
    publishedAt: 'Published',
    otherLanguage: 'Tiếng Việt',
    notFoundTitle: 'Page not found',
    notFoundBody: 'That address does not exist, or the article was removed.',
    backHome: 'Back to the front page',
    noArticles: 'No articles in this section yet.',
  },
};
