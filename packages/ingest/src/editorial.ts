/**
 * Bài xã luận do biên tập viên (người hoặc agent) tự nghiên cứu và viết, khác
 * với bài đi qua `pipeline.ts` vốn chỉ viết lại tin có sẵn từ NewsData.
 *
 * Toàn bộ ràng buộc SEO nằm ở đây chứ không nằm trong prompt: prompt là lời
 * khuyên, còn `validateDraft` là cánh cổng. Một agent chạy không người giám
 * sát sẽ trôi khỏi hướng dẫn trong prompt, nhưng không trôi qua được hàm này.
 */
import { slugify } from '@news/db';
import { feedCategories } from './feeds.js';
import type { LangContent, StorableArticle } from './store.js';

export type EditorialSource = { name: string; url: string };

export type EditorialDraft = {
  category: string;
  /** Keyword chính, phải xuất hiện tự nhiên trong tiêu đề tiếng Anh. */
  keyword: string;
  publishedAt: Date;
  model: string;
  primarySource: EditorialSource;
  /** URL đã đọc để lấy dữ kiện — dưới hai nguồn thì không đăng. */
  sources: string[];
  imageUrl: string | null;
  tags: string[];
  en: LangContent;
  vi: LangContent;
};

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

/** Google cắt tiêu đề quanh 60 ký tự; dưới 40 thì thường là tiêu đề cụt ý. */
const TITLE_MIN = 40;
const TITLE_MAX = 65;
/** Meta description ngoài khoảng này bị viết lại hoặc cắt giữa chừng. */
const SUMMARY_MIN = 120;
const SUMMARY_MAX = 165;
const BODY_MIN_WORDS = 500;
const BODY_MAX_WORDS = 1200;
const BODY_MIN_PARAGRAPHS = 5;
const MIN_SOURCES = 2;
const TAGS_MIN = 3;
const TAGS_MAX = 6;
/** Trên ngưỡng này thì đọc ra là nhồi keyword chứ không còn là văn tự nhiên. */
const MAX_KEYWORD_DENSITY = 0.03;

const PLACEHOLDER = /\b(todo|tbd|fixme|lorem ipsum|xxx|\[insert)\b/i;

const LANGS = ['en', 'vi'] as const;
type Lang = (typeof LANGS)[number];

function words(text: string): string[] {
  return text.split(/\s+/).filter((word) => word !== '');
}

function paragraphCount(body: string): number {
  return body
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter((para) => para !== '').length;
}

/** So khớp trên chuỗi đã chuẩn hoá thay vì escape keyword thành regex. */
function normalizeSpaces(text: string): string {
  return words(text).join(' ').toLowerCase();
}

/** Đếm cả cụm keyword nhiều chữ, không phân biệt hoa thường. */
function keywordOccurrences(body: string, keyword: string): number {
  const haystack = normalizeSpaces(body);
  const needle = normalizeSpaces(keyword);
  if (needle === '') return 0;

  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

function keywordDensity(body: string, keyword: string): number {
  const total = words(body).length;
  if (total === 0) return 0;
  return (keywordOccurrences(body, keyword) * words(keyword).length) / total;
}

function checkContent(lang: Lang, content: LangContent, errors: string[]): void {
  const title = content.title.trim();
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    errors.push(`${lang}.title: ${title.length} ký tự, cần ${TITLE_MIN}-${TITLE_MAX}`);
  }

  const summary = content.summary.trim();
  if (summary.length < SUMMARY_MIN || summary.length > SUMMARY_MAX) {
    errors.push(`${lang}.summary: ${summary.length} ký tự, cần ${SUMMARY_MIN}-${SUMMARY_MAX}`);
  }

  const wordCount = words(content.body).length;
  if (wordCount < BODY_MIN_WORDS || wordCount > BODY_MAX_WORDS) {
    errors.push(`${lang}.body: ${wordCount} từ, cần ${BODY_MIN_WORDS}-${BODY_MAX_WORDS}`);
  }
  if (paragraphCount(content.body) < BODY_MIN_PARAGRAPHS) {
    errors.push(`${lang}.body: dưới ${BODY_MIN_PARAGRAPHS} đoạn`);
  }

  for (const [field, value] of Object.entries(content)) {
    if (PLACEHOLDER.test(value)) errors.push(`${lang}.${field}: còn placeholder chưa điền`);
  }
}

export function validateDraft(draft: EditorialDraft): ValidationResult {
  const errors: string[] = [];

  const categories = feedCategories();
  if (!categories.includes(draft.category)) {
    errors.push(`category "${draft.category}" ngoài danh sách ngách: ${categories.join(', ')}`);
  }

  const keyword = draft.keyword.trim();
  if (keyword === '') {
    errors.push('keyword: bỏ trống');
  } else {
    if (!draft.en.title.toLowerCase().includes(keyword.toLowerCase())) {
      errors.push(`keyword "${keyword}" vắng mặt trong tiêu đề tiếng Anh`);
    }
    const density = keywordDensity(draft.en.body, keyword);
    if (density > MAX_KEYWORD_DENSITY) {
      errors.push(
        `keyword nhồi quá dày: ${(density * 100).toFixed(1)}%, trần ${MAX_KEYWORD_DENSITY * 100}%`,
      );
    }
  }

  const validSources = draft.sources.filter((url) => URL.canParse(url));
  if (validSources.length < MIN_SOURCES) {
    errors.push(`sources: ${validSources.length} nguồn hợp lệ, cần ít nhất ${MIN_SOURCES}`);
  }
  if (!URL.canParse(draft.primarySource.url)) {
    errors.push('sources: primarySource.url không phải URL hợp lệ');
  }

  if (draft.tags.length < TAGS_MIN || draft.tags.length > TAGS_MAX) {
    errors.push(`tags: ${draft.tags.length} thẻ, cần ${TAGS_MIN}-${TAGS_MAX}`);
  }
  if (draft.tags.some((tag) => tag !== tag.toLowerCase() || tag.trim() === '')) {
    errors.push('tags: phải viết thường và không rỗng');
  }

  for (const lang of LANGS) checkContent(lang, draft[lang], errors);

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/** Ngày UTC, để cùng một bản thảo luôn sinh ra cùng một sourceId. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toStorableArticle(draft: EditorialDraft): StorableArticle {
  return {
    // Tiền tố "editorial:" tách hẳn khỏi id của NewsData, nên bài tự viết
    // không bao giờ va vào bài thu thập dù tiêu đề có giống nhau.
    sourceId: `editorial:${isoDate(draft.publishedAt)}:${slugify(draft.en.title)}`,
    title: draft.en.title,
    sourceName: draft.primarySource.name,
    sourceUrl: draft.primarySource.url,
    imageUrl: draft.imageUrl,
    category: draft.category,
    publishedAt: draft.publishedAt,
    model: draft.model,
    contents: { vi: draft.vi, en: draft.en },
  };
}

export type ParseResult =
  | { ok: true; draft: EditorialDraft }
  | { ok: false; errors: string[] };

function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function contentOf(value: unknown): LangContent {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    title: stringOf(raw['title']),
    summary: stringOf(raw['summary']),
    body: stringOf(raw['body']),
  };
}

/**
 * Cổng vào cho bản thảo JSON do agent sinh ra: kiểm tra hình dạng trước, rồi
 * mới tới luật SEO. Tách hai bước để lỗi "thiếu khối vi" không bị chôn dưới
 * một tá lỗi độ dài sinh ra từ chuỗi rỗng.
 */
export function parseDraft(raw: unknown, options: { now: Date }): ParseResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ['bản thảo phải là một đối tượng JSON'] };
  }

  const input = raw as Record<string, unknown>;
  const shapeErrors: string[] = [];

  for (const lang of LANGS) {
    const block = input[lang];
    if (typeof block !== 'object' || block === null) {
      shapeErrors.push(`${lang}: thiếu khối nội dung`);
    }
  }

  let publishedAt = options.now;
  const rawDate = input['publishedAt'];
  if (typeof rawDate === 'string' && rawDate !== '') {
    const parsedDate = new Date(rawDate);
    if (Number.isNaN(parsedDate.getTime())) {
      shapeErrors.push(`publishedAt: "${rawDate}" không phải thời điểm hợp lệ`);
    } else {
      publishedAt = parsedDate;
    }
  } else if (rawDate !== undefined) {
    shapeErrors.push('publishedAt: phải là chuỗi ISO hoặc bỏ trống');
  }

  const primary = (input['primarySource'] ?? {}) as Record<string, unknown>;
  const imageUrl = input['imageUrl'];

  const draft: EditorialDraft = {
    category: stringOf(input['category']),
    keyword: stringOf(input['keyword']),
    publishedAt,
    model: stringOf(input['model']) || 'editorial',
    primarySource: { name: stringOf(primary['name']), url: stringOf(primary['url']) },
    sources: Array.isArray(input['sources'])
      ? input['sources'].filter((url): url is string => typeof url === 'string')
      : [],
    imageUrl: typeof imageUrl === 'string' && imageUrl !== '' ? imageUrl : null,
    tags: Array.isArray(input['tags'])
      ? input['tags'].filter((tag): tag is string => typeof tag === 'string')
      : [],
    en: contentOf(input['en']),
    vi: contentOf(input['vi']),
  };

  if (shapeErrors.length > 0) return { ok: false, errors: shapeErrors };

  const validation = validateDraft(draft);
  return validation.ok ? { ok: true, draft } : { ok: false, errors: validation.errors };
}
