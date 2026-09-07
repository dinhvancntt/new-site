export const REWRITE_MODEL = 'deepseek-v4-flash';
export const MAX_TOKENS = 8000;
export const BAI_BASE_URL = 'https://api.b.ai/v1';
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const GEMINI_MODEL = 'gemini-3.6-flash';
export const MAX_ATTEMPTS = 4;

export interface RewriteInput {
  title: string;
  body: string;
  sourceName: string;
  category: string;
}

export interface RewrittenArticle {
  title_vi: string;
  title_en: string;
  summary_vi: string;
  summary_en: string;
  body_vi: string;
  body_en: string;
  tags: string[];
  category: string;
}

export type RewriteResult =
  | { ok: true; article: RewrittenArticle }
  | { ok: false; reason: 'insufficient' | 'refusal' | 'error' };

const SYSTEM_PROMPT = `Bạn là biên tập viên viết lại tin quốc tế cho một trang tin song ngữ Việt - Anh.

Với thân bài gốc được cung cấp, viết một bản tin hoàn chỉnh bằng cả tiếng Việt và tiếng Anh.

Ràng buộc bắt buộc:
- Chỉ dùng dữ kiện có trong thân bài gốc được cung cấp.
- Không thêm số liệu, ngày tháng, tên riêng hay trích dẫn không có trong bài gốc.
- Không suy đoán nguyên nhân, hệ quả hay diễn biến tiếp theo.
- Không nêu ý kiến, không đứng về phía nào.
- Bản tiếng Việt phải là văn viết báo tự nhiên, không dịch từng chữ.
- Thân bài dài 3-5 đoạn; tóm tắt tối đa 2 câu; 3-6 thẻ tags viết thường.
- Nếu bài gốc không đủ dữ kiện để viết, đặt insufficient: true thay vì viết bừa.

Chỉ trả về một JSON object duy nhất, không kèm markdown hay lời giải thích, gồm đúng các khoá:
- "title_vi", "title_en": string, tiêu đề hai thứ tiếng.
- "summary_vi", "summary_en": string, tóm tắt tối đa 2 câu.
- "body_vi", "body_en": string, các đoạn cách nhau bằng một dòng trống.
- "tags": array gồm 3-6 string viết thường.
- "insufficient": boolean, true khi bài gốc không đủ dữ kiện.`;

export function buildRewriteRequest(input: RewriteInput, model: string = REWRITE_MODEL) {
  return {
    model,
    max_tokens: MAX_TOKENS,
    // Provider không nhận JSON Schema, chỉ có JSON mode — nên schema nằm ở
    // system prompt và mọi field đều được kiểm lại ở validateArticle().
    response_format: { type: 'json_object' as const },
    messages: [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      {
        role: 'user' as const,
        content: `Nguồn: ${input.sourceName}\nTiêu đề gốc: ${input.title}\n\nThân bài gốc:\n${input.body}`,
      },
    ],
  };
}

export interface RewriteCompletion {
  finish_reason: string | null;
  text: string;
}

export interface RewriteDeps {
  complete: (request: ReturnType<typeof buildRewriteRequest>) => Promise<RewriteCompletion>;
}

export type RewriteProvider = 'bai' | 'gemini';

export type RewriteConfig = {
  provider: RewriteProvider;
  apiKey: string | undefined;
  baseUrl: string;
  model: string;
};

/**
 * Chọn provider viết lại qua biến môi trường, mặc định giữ BAI cũ:
 * REWRITE_PROVIDER=gemini + GEMINI_API_KEY (đổi model bằng GEMINI_MODEL).
 */
export function resolveRewriteConfig(env: Record<string, string | undefined> = process.env): RewriteConfig {
  // Chuẩn hoá vì giá trị paste từ UI dễ dính hoa/thường hoặc khoảng trắng.
  // Nếu không ghi rõ mà có key Gemini thì dùng Gemini luôn — đỡ phụ thuộc
  // vào một secret cấu hình dễ gõ sai.
  const raw = (env['REWRITE_PROVIDER'] ?? '').trim().toLowerCase();
  if (raw === 'bai') {
    return { provider: 'bai', apiKey: env['BAI_API_KEY'], baseUrl: BAI_BASE_URL, model: REWRITE_MODEL };
  }
  if (raw === 'gemini' || (!raw && env['GEMINI_API_KEY'])) {
    return {
      provider: 'gemini',
      apiKey: env['GEMINI_API_KEY'],
      baseUrl: env['GEMINI_BASE_URL'] ?? GEMINI_BASE_URL,
      model: env['GEMINI_MODEL'] ?? GEMINI_MODEL,
    };
  }
  return { provider: 'bai', apiKey: env['BAI_API_KEY'], baseUrl: BAI_BASE_URL, model: REWRITE_MODEL };
}

const RETRY_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Log 1 lần mỗi run khi chạm trần rate limit để Actions thấy được. */
let rateLimitWarned = false;

/** Backoff mũ, ưu tiên Retry-After của server. */
function retryDelay(attempt: number, retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 30_000);
  return Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 250;
}

export function createRewriteClient(
  apiKey = process.env['BAI_API_KEY'],
  baseUrl = BAI_BASE_URL,
): RewriteDeps {
  return {
    complete: async (request) => {
      let lastError: Error = new Error('không gọi được provider');

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        if (attempt > 0) await sleep(retryDelay(attempt - 1, null));

        let response: Response;
        try {
          response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${apiKey}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify(request),
            signal: AbortSignal.timeout(180_000),
          });
        } catch (cause) {
          lastError = new Error('lỗi mạng khi gọi provider', { cause });
          continue;
        }

        if (!response.ok) {
          const detail = (await response.text().catch(() => '')).slice(0, 300);
          lastError = new Error(`provider trả HTTP ${response.status}: ${detail}`);
          if (response.status === 429 && !rateLimitWarned) {
            rateLimitWarned = true;
            console.warn(
              `rewrite rate limited (HTTP 429, retry-after=${response.headers.get('retry-after') ?? 'none'})`,
            );
          }
          if (!RETRY_STATUS.has(response.status)) throw lastError;
          await sleep(retryDelay(attempt, response.headers.get('retry-after')));
          continue;
        }

        const payload = (await response.json()) as {
          choices?: { finish_reason?: string | null; message?: { content?: string | null } }[];
        };
        const choice = payload.choices?.[0];
        return {
          finish_reason: choice?.finish_reason ?? null,
          text: choice?.message?.content ?? '',
        };
      }

      throw lastError;
    },
  };
}

const FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/;

/** Giữ 1 dòng lỗi provider đầu tiên mỗi process để log Actions đọc được. */
let providerErrorLogged = false;

function logProviderErrorOnce(error: unknown): void {
  if (providerErrorLogged) return;
  providerErrorLogged = true;
  const text = error instanceof Error ? error.message : String(error);
  console.error(`rewrite provider error: ${text.slice(0, 300)}`);
}/** Model đôi khi bọc JSON trong fence dù đã bật JSON mode. */
function stripFence(text: string): string {
  const trimmed = text.trim();
  return FENCE.exec(trimmed)?.[1]?.trim() ?? trimmed;
}

const STRING_FIELDS = [
  'title_vi',
  'title_en',
  'summary_vi',
  'summary_en',
  'body_vi',
  'body_en',
] as const;

/** Thay cho JSON Schema phía server: field thiếu hoặc sai kiểu là loại bài. */
function validateArticle(value: Record<string, unknown>): Omit<RewrittenArticle, 'category'> | null {
  for (const field of STRING_FIELDS) {
    const candidate = value[field];
    if (typeof candidate !== 'string' || candidate.trim() === '') return null;
  }

  const tags = value['tags'];
  if (!Array.isArray(tags) || tags.length === 0) return null;
  if (!tags.every((tag): tag is string => typeof tag === 'string' && tag.trim() !== '')) return null;

  return {
    title_vi: value['title_vi'] as string,
    title_en: value['title_en'] as string,
    summary_vi: value['summary_vi'] as string,
    summary_en: value['summary_en'] as string,
    body_vi: value['body_vi'] as string,
    body_en: value['body_en'] as string,
    tags: tags.map((tag) => tag.trim()),
  };
}

export async function rewriteArticle(
  input: RewriteInput,
  deps: RewriteDeps,
  model: string = REWRITE_MODEL,
): Promise<RewriteResult> {
  let completion: RewriteCompletion;
  try {
    completion = await deps.complete(buildRewriteRequest(input, model));
  } catch (error) {
    // Chỉ log lỗi provider đầu tiên mỗi run để Actions đọc được HTTP status,
    // các bài sau fail cùng nguyên nhân thì counters đã đủ.
    logProviderErrorOnce(error);
    return { ok: false, reason: 'error' };
  }

  // Xét finish_reason trước khi chạm vào content — spec Bước 4.
  if (completion.finish_reason === 'content_filter') return { ok: false, reason: 'refusal' };

  const text = stripFence(completion.text);
  if (text === '') return { ok: false, reason: 'error' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'error' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: 'error' };
  }

  const output = parsed as Record<string, unknown>;
  if (output['insufficient'] === true) return { ok: false, reason: 'insufficient' };

  const article = validateArticle(output);
  if (!article) return { ok: false, reason: 'error' };

  return { ok: true, article: { ...article, category: input.category } };
}
