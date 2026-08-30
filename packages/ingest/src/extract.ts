import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

/** Thân bài ngắn hơn ngưỡng này coi như rút thất bại — xem spec Bước 3. */
export const MIN_BODY_LENGTH = 400;

const FETCH_TIMEOUT_MS = 20_000;

const USER_AGENT =
  'Mozilla/5.0 (compatible; NewsAggregatorBot/1.0; +https://github.com/kevin/news-site)';

export interface ExtractOptions {
  fetchImpl?: typeof fetch;
}

export interface ExtractedArticle {
  text: string;
}

export async function extractArticle(
  url: string,
  options: ExtractOptions = {},
): Promise<ExtractedArticle | null> {
  const fetchImpl = options.fetchImpl ?? fetch;

  let html: string;
  try {
    const response = await fetchImpl(url, {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    html = await response.text();
  } catch {
    return null;
  }

  let text: string;
  try {
    const dom = new JSDOM(html, { url });
    const parsed = new Readability(dom.window.document).parse();
    if (!parsed?.textContent) return null;
    text = normalizeWhitespace(parsed.textContent);
  } catch {
    return null;
  }

  return text.length >= MIN_BODY_LENGTH ? { text } : null;
}

function normalizeWhitespace(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n\n');
}
