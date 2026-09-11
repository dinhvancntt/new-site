/**
 * IndexNow — báo URL mới cho Bing/Yandex/Seznam ngay khi ghi xong, thay vì chờ
 * bot ghé lại. Google không tham gia giao thức này.
 *
 * Bước này là best effort: search engine chết không được làm hỏng một run
 * ingest đã ghi dữ liệu thành công.
 */

export const INDEXNOW_MAX_URLS = 10_000;

const DEFAULT_ENDPOINT = 'https://api.indexnow.org/indexnow';

export type IndexNowConfig = {
  /** Hostname trần, không kèm scheme — phải khớp host của mọi URL gửi đi. */
  host: string;
  key: string;
  /** Mặc định `https://<host>/<key>.txt`, đúng chỗ file khoá được phục vụ. */
  keyLocation?: string;
  endpoint?: string;
};

/** Chỉ nhận đúng hình dạng lời gọi ở dưới, để test mock gọn mà vẫn kiểu chặt. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type IndexNowResult = {
  submitted: number;
  status: number | null;
  skipped?: 'empty' | 'no-key';
  error?: string;
};

function sameHostUrls(urls: string[], host: string): string[] {
  const seen = new Set<string>();
  for (const raw of urls) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      continue;
    }
    if (parsed.host !== host) continue;
    seen.add(parsed.toString());
    if (seen.size === INDEXNOW_MAX_URLS) break;
  }
  return [...seen];
}

export async function submitIndexNow(
  urls: string[],
  config: IndexNowConfig,
  fetchImpl: FetchLike = fetch,
): Promise<IndexNowResult> {
  if (!config.key) return { submitted: 0, status: null, skipped: 'no-key' };

  const urlList = sameHostUrls(urls, config.host);
  if (urlList.length === 0) return { submitted: 0, status: null, skipped: 'empty' };

  const body = JSON.stringify({
    host: config.host,
    key: config.key,
    keyLocation: config.keyLocation ?? `https://${config.host}/${config.key}.txt`,
    urlList,
  });

  try {
    const response = await fetchImpl(config.endpoint ?? DEFAULT_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body,
    });
    if (!response.ok) return { submitted: 0, status: response.status };
    return { submitted: urlList.length, status: response.status };
  } catch (error) {
    return {
      submitted: 0,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
