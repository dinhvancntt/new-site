export type FetchedArticle = {
  sourceId: string;
  title: string;
  description: string | null;
  link: string;
  imageUrl: string | null;
  sourceName: string;
  category: string;
  publishedAt: Date;
};

type RawArticle = {
  article_id?: unknown;
  title?: unknown;
  description?: unknown;
  link?: unknown;
  image_url?: unknown;
  source_name?: unknown;
  pubDate?: unknown;
};

export type FetchCategoryOptions = {
  apiKey: string;
  category: string;
  fetchImpl?: typeof fetch;
};

/** NewsData trả pubDate dạng "YYYY-MM-DD HH:mm:ss" theo giờ UTC, không kèm hậu tố. */
function parsePubDate(value: string): Date {
  return new Date(`${value.replace(' ', 'T')}Z`);
}

export async function fetchCategory({
  apiKey,
  category,
  fetchImpl = fetch,
}: FetchCategoryOptions): Promise<FetchedArticle[]> {
  const url = new URL('https://newsdata.io/api/1/latest');
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('category', category);
  url.searchParams.set('language', 'en');

  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new Error(
      `NewsData trả lỗi ${response.status} cho chuyên mục "${category}"`,
    );
  }

  const body = (await response.json()) as { results?: RawArticle[] };

  return (body.results ?? [])
    .map((raw) => toArticle(raw, category))
    .filter((article): article is FetchedArticle => article !== null);
}

// Wire feed hay nhét pixel theo dõi vào `image_url` (ví dụ rt.prnewswire.com/rt.gif).
// Chúng trả về 200 image/gif nên không thể phát hiện bằng cách gọi thử; phải lọc theo hình dạng URL.
const BEACON_HINTS = ['beacon', 'pixel', 'track', '1x1', 'spacer', 'blank', 'rt.gif'];

export function sanitizeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null; // URL tương đối hoặc rác thì bỏ, vì sau này còn đưa qua dịch vụ resize.
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  // Ảnh tin tức thật gần như luôn là jpg/png/webp; gif trong feed hầu hết là beacon.
  if (url.pathname.toLowerCase().endsWith('.gif')) return null;

  const haystack = `${url.hostname}${url.pathname}`.toLowerCase();
  if (BEACON_HINTS.some((hint) => haystack.includes(hint))) return null;

  return value;
}

function toArticle(raw: RawArticle, category: string): FetchedArticle | null {
  const sourceId = raw.article_id;
  const title = raw.title;
  const link = raw.link;

  if (typeof sourceId !== 'string' || sourceId === '') return null;
  if (typeof title !== 'string' || title.trim() === '') return null;
  if (typeof link !== 'string' || link === '') return null;
  if (typeof raw.pubDate !== 'string') return null;

  const publishedAt = parsePubDate(raw.pubDate);
  if (Number.isNaN(publishedAt.getTime())) return null;

  return {
    sourceId,
    title: title.trim(),
    description: typeof raw.description === 'string' ? raw.description : null,
    link,
    imageUrl: sanitizeImageUrl(raw.image_url),
    sourceName: typeof raw.source_name === 'string' ? raw.source_name : 'Unknown',
    category,
    publishedAt,
  };
}
