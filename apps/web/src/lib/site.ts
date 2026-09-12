import type { Lang } from './lang';

export const SITE_NAME = 'Tin nhanh';

/** Mô tả dài cho thẻ meta description / OG — tagline ngắn vẫn dùng để hiển thị UI. */
export const SITE_DESCRIPTION: Record<Lang, string> = {
  vi: 'Tin nhanh: cập nhật tin thế giới, kinh doanh, công nghệ, thể thao, sức khỏe từ các hãng tin quốc tế, tóm lược tự động bằng AI, nhanh gọn mỗi 5 phút.',
  en: 'Breaking world, business, technology, sports and health news from international wires, automatically summarised by AI and updated every 5 minutes.',
};

export const OG_LOCALE: Record<Lang, string> = { vi: 'vi_VN', en: 'en_US' };

/**
 * Cặp hreflang song ngữ kèm x-default trỏ về bản Việt (bản chính).
 * Google dùng x-default khi không khớp ngôn ngữ nào của người tìm kiếm.
 */
export function hreflangAlternates(viPath: string, enPath: string): Record<string, string> {
  return { 'x-default': viPath, vi: viPath, en: enPath };
}

/** Ngách đang thu thập (khớp packages/ingest FEEDS) — chỉ những mục này lên nav. */
export const NAV_CATEGORIES = ['motorsport', 'cycling', 'equestrian'] as const;

/**
 * Toàn bộ chuyên mục còn định tuyến được, gồm cả 5 mục rộng đã ngừng thu thập.
 * Bài cũ vẫn nằm trong DB và một số đang có thứ hạng, nên route và sitemap
 * phải giữ lại; chỉ nav là thu gọn về ngách mới.
 */
export const CATEGORIES = [
  ...NAV_CATEGORIES,
  'world',
  'business',
  'technology',
  'sports',
  'health',
] as const;

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
    motorsport: 'Đua xe',
    cycling: 'Xe đạp',
    equestrian: 'Thể thao ngựa',
    world: 'Thế giới',
    business: 'Kinh doanh',
    technology: 'Công nghệ',
    sports: 'Thể thao',
    health: 'Sức khoẻ',
  },
  en: {
    motorsport: 'Motorsport',
    cycling: 'Cycling',
    equestrian: 'Equestrian',
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

/** Mô tả tĩnh mỗi chuyên mục: chống thin content, cho Google hiểu trang mục viết về gì. */
export const CATEGORY_DESCRIPTION: Record<Lang, Record<Category, string>> = {
  vi: {
    motorsport:
      'Tin đua xe mới nhất: F1, IndyCar, NASCAR, WEC và các giải đua cơ sở — kết quả chặng, lịch thi đấu và chuyển nhượng tay đua.',
    cycling:
      'Tin đua xe đạp mới nhất: Tour de France, Giro, Vuelta và lịch WorldTour — kết quả từng chặng cùng tin đội đua.',
    equestrian:
      'Tin thể thao ngựa mới nhất: nhảy chướng ngại vật, eventing và dressage — tường thuật giải đấu và chăm sóc ngựa thi đấu.',
    world: 'Tin thế giới mới nhất: chính trị, xung đột, ngoại giao và các sự kiện toàn cầu, tổng hợp từ hãng tin quốc tế và tóm lược trong 1 phút.',
    business: 'Tin kinh doanh mới nhất: thị trường, tài chính, doanh nghiệp và chính sách kinh tế toàn cầu, tóm lược nhanh mỗi ngày.',
    technology: 'Tin công nghệ mới nhất: AI, chip, thiết bị, startup và chuyển đổi số trên toàn thế giới, cập nhật liên tục.',
    sports: 'Tin thể thao mới nhất: bóng đá, quần vợt, đua xe và các giải đấu lớn toàn cầu, kết quả và chuyển nhượng.',
    health: 'Tin sức khỏe mới nhất: y tế, dịch bệnh, dinh dưỡng và nghiên cứu khoa học đáng chú ý trên thế giới.',
  },
  en: {
    motorsport:
      'Latest motorsport news: F1, IndyCar, NASCAR, WEC and grassroots racing — race results, schedules and driver moves.',
    cycling:
      'Latest cycling news: Tour de France, Giro, Vuelta and the WorldTour calendar — stage results and team news.',
    equestrian:
      'Latest equestrian news: showjumping, eventing and dressage — competition reports and care of the competition horse.',
    world: 'Latest world news: politics, conflicts, diplomacy and global events from international wires, summarised in one minute.',
    business: 'Latest business news: markets, finance, companies and economic policy worldwide, briefly summarised daily.',
    technology: 'Latest technology news: AI, chips, gadgets, startups and digital transformation across the globe.',
    sports: 'Latest sports news: football, tennis, racing and major tournaments worldwide, scores and transfers.',
    health: 'Latest health news: medicine, outbreaks, nutrition and notable research from around the world.',
  },
};

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
  related: string;
  share: string;
  copyLink: string;
  copied: string;
  about: string;
  contact: string;
  policy: string;
  archive: string;
  viewAll: string;
  newerPage: string;
  olderPage: string;
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
    related: 'Tin liên quan',
    share: 'Chia sẻ',
    copyLink: 'Copy link',
    copied: 'Đã copy!',
    about: 'Giới thiệu',
    contact: 'Liên hệ',
    policy: 'Chính sách',
    archive: 'Lưu trữ tin',
    viewAll: 'Xem tất cả',
    newerPage: '← Mới hơn',
    olderPage: 'Cũ hơn →',
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
    related: 'Related stories',
    share: 'Share',
    copyLink: 'Copy link',
    copied: 'Copied!',
    about: 'About',
    contact: 'Contact',
    policy: 'Policy',
    archive: 'Archive',
    viewAll: 'View all',
    newerPage: '← Newer',
    olderPage: 'Older →',
  },
};
