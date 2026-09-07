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
  | { ok: false; reason: 'insufficient' | 'refusal' | 'error' | 'quota' };

/**
 * Trần free tier đọc từ panel Rate Limit của AI Studio (RPM = request/phút,
 * RPD = request/ngày). Model lạ thì lấy mức chặt nhất để không đốt quota vào
 * những lần thử vô ích.
 */
// GitHub Actions truyền biến repo chưa đặt thành chuỗi rỗng, nên `??` không
// đủ để rơi về mặc định. Rỗng hoặc chỉ khoảng trắng đều coi như chưa đặt.
function optional(env: Record<string, string | undefined>, name: string): string | undefined {
  const value = (env[name] ?? '').trim();
  return value === '' ? undefined : value;
}

export const GEMINI_LIMITS: Record<string, { rpm: number; rpd: number }> = {
  'gemini-3.6-flash': { rpm: 5, rpd: 20 },
  'gemini-3.5-flash': { rpm: 5, rpd: 20 },
  'gemini-2.5-flash': { rpm: 5, rpd: 20 },
  'gemini-3.5-flash-lite': { rpm: 15, rpd: 500 },
  'gemini-3.1-flash-lite': { rpm: 15, rpd: 500 },
};

export const CONSERVATIVE_LIMIT = { rpm: 5, rpd: 20 };

/**
 * Quota free của Google tính riêng cho từng model, nên xếp thang: bài đầu đi
 * model tốt nhất, hết hạn mức ngày thì tụt xuống bậc dưới hạn mức cao hơn.
 * Tổng hạn mức của thang lớn hơn nhiều so với bám một model.
 */
export const DEFAULT_MODEL_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

export interface LadderRung {
  model: string;
  rpm: number;
  rpd: number;
}

export function ladderFor(models: string[]): LadderRung[] {
  return models.map((model) => ({ model, ...limitsFor(model) }));
}

/** Thang lấy từ GEMINI_MODELS (cách nhau bằng dấu phẩy), rỗng thì dùng mặc định. */
export function resolveModelLadder(env: Record<string, string | undefined>): LadderRung[] {
  const listed = (optional(env, 'GEMINI_MODELS') ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
  return ladderFor(listed.length > 0 ? listed : DEFAULT_MODEL_LADDER);
}

/** Trần số bài cho cả run: tổng hạn mức ngày của mọi bậc. */
export function ladderBudget(rungs: LadderRung[], override?: string): number {
  const asked = Number(override);
  if (Number.isInteger(asked) && asked > 0) return asked;
  return rungs.reduce((total, rung) => total + Math.floor(rung.rpd * 0.9), 0);
}

export function limitsFor(model: string): { rpm: number; rpd: number } {
  return GEMINI_LIMITS[model] ?? CONSERVATIVE_LIMIT;
}

/** Chừa 10% biên vì đồng hồ RPM của Google không trùng đồng hồ của ta. */
const SAFETY = 1.1;

/** Khoảng cách tối thiểu giữa hai request để nằm dưới trần RPM. */
export function paceIntervalMs(model: string): number {
  return Math.ceil((60_000 / limitsFor(model).rpm) * SAFETY);
}

/** Số bài tối đa gọi model trong một run, chừa biên dưới trần RPD. */
export function budgetFor(model: string, override?: string): number {
  const asked = Number(override);
  if (Number.isInteger(asked) && asked > 0) return asked;
  return Math.floor(limitsFor(model).rpd * 0.9);
}

/** Hết quota là chuyện thường của free tier, không phải bài viết lỗi. */
export class RewriteQuotaError extends Error {
  constructor(detail: string) {
    super(`hết quota provider: ${detail}`);
    this.name = 'RewriteQuotaError';
  }
}

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
  const raw = (optional(env, 'REWRITE_PROVIDER') ?? '').toLowerCase();
  if (raw === 'bai') {
    return { provider: 'bai', apiKey: optional(env, 'BAI_API_KEY'), baseUrl: BAI_BASE_URL, model: REWRITE_MODEL };
  }
  if (raw === 'gemini' || (!raw && optional(env, 'GEMINI_API_KEY'))) {
    return {
      provider: 'gemini',
      apiKey: optional(env, 'GEMINI_API_KEY'),
      baseUrl: optional(env, 'GEMINI_BASE_URL') ?? GEMINI_BASE_URL,
      model: optional(env, 'GEMINI_MODEL') ?? GEMINI_MODEL,
    };
  }
  return { provider: 'bai', apiKey: optional(env, 'BAI_API_KEY'), baseUrl: BAI_BASE_URL, model: REWRITE_MODEL };
}

// 429 không nằm ở đây: trần free tier tính theo request, nên thử lại chỉ đốt
// thêm quota rồi vẫn 429. Gặp 429 là dừng, để pipeline bỏ qua phần còn lại.
const RETRY_STATUS = new Set([408, 409, 425, 500, 502, 503, 504]);

/** Log Actions tách dòng: gộp về một dòng để mỗi sự kiện là một entry. */
function oneLine(text: string): string {
  return text.replace(/s+/g, ' ').trim();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Log 1 lần mỗi run khi chạm trần rate limit để Actions thấy được. */
let rateLimitWarned = false;

/** Backoff mũ, ưu tiên Retry-After của server. */
function retryDelay(attempt: number, retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 30_000);
  return Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 250;
}

/** Lý do 429: vượt trần phút thì chờ được, vượt trần ngày thì phải đổi model. */
export function quotaIds(body: string): string {
  let ids = '';
  for (const root of parseErrorRoots(body)) {
    for (const detail of root.error?.details ?? []) {
      for (const violation of detail.violations ?? []) {
        ids += `${violation.quotaId ?? ''} ${violation.quotaMetric ?? ''} `;
      }
    }
  }
  return ids.trim();
}

/** Endpoint tương thích OpenAI trả `[{error}]`, API gốc trả `{error}`. */
function parseErrorRoots(body: string): ErrorRoot[] {
  try {
    const parsed = JSON.parse(body) as ErrorRoot | ErrorRoot[];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

interface ErrorRoot {
  error?: { details?: { violations?: { quotaId?: string; quotaMetric?: string }[] }[] };
}

export function quotaScope(body: string): 'day' | 'minute' {
  const haystack = `${quotaIds(body)} ${body}`;
  if (/per[_s-]?minute/i.test(haystack)) return 'minute';
  // Không nói rõ thì coi như hết ngày: tụt bậc còn dùng được, chứ gọi lại
  // cùng model chỉ đốt thêm quota rồi vẫn 429.
  return 'day';
}

/** Model bị gỡ hoặc gõ sai: bậc đó vô dụng, nhưng không được làm hỏng cả run. */
function isModelUnavailable(status: number, body: string): boolean {
  if (status === 404) return true;
  return status === 400 && /not\s+found|not\s+supported|INVALID_ARGUMENT/i.test(body);
}

/** Bậc thang đã chết vì hết hạn mức ngày hoặc model không dùng được. */
class RungDeadError extends Error {
  constructor(readonly why: string) {
    super(why);
  }
}

interface RungState {
  /** undefined = giữ model có trong request (đường BAI cũ). */
  model: string | undefined;
  intervalMs: number;
  remaining: number;
  nextSlot: number;
  dead: boolean;
}

function toRungStates(pace: number | LadderRung[]): RungState[] {
  if (typeof pace === 'number') {
    return [{ model: undefined, intervalMs: pace, remaining: Infinity, nextSlot: 0, dead: false }];
  }
  return pace.map((rung) => ({
    model: rung.model,
    // Nhịp suy từ RPM của chính bậc đó, không tra lại bảng: người gọi có thể
    // truyền hạn mức khác bảng (test, hoặc GEMINI_MODELS trỏ model mới).
    intervalMs: Math.ceil((60_000 / rung.rpm) * SAFETY),
    remaining: Math.floor(rung.rpd * 0.9),
    nextSlot: 0,
    dead: false,
  }));
}

export function createRewriteClient(
  apiKey = process.env['BAI_API_KEY'],
  baseUrl = BAI_BASE_URL,
  pace: number | LadderRung[] = 0,
): RewriteDeps {
  // Nhịp gọi và hạn mức giữ theo từng bậc: RPM/RPD của Google tính riêng cho
  // mỗi model, nên hai bài chạy song song vẫn phải nối đuôi trong cùng bậc.
  const rungs = toRungStates(pace);
  const usable = (): RungState | undefined =>
    rungs.find((rung) => !rung.dead && rung.remaining > 0);

  const takeSlot = async (rung: RungState): Promise<void> => {
    if (rung.intervalMs <= 0) return;
    const now = Date.now();
    const startAt = Math.max(now, rung.nextSlot);
    rung.nextSlot = startAt + rung.intervalMs;
    if (startAt > now) await sleep(startAt - now);
  };

  const killRung = (rung: RungState, why: string): void => {
    if (rung.dead) return; // hai luồng cùng đụng 429 của một bậc
    rung.dead = true;
    const next = usable();
    console.warn(
      `rewrite: bậc ${rung.model ?? 'mặc định'} dừng (${oneLine(why)})` +
        (next ? `, tụt xuống ${next.model}` : ', hết thang'),
    );
  };

  /** Gọi một bậc tới cùng: chỉ trả về khi xong, hoặc ném lỗi cho bậc/bài. */
  const completeOn = async (
    rung: RungState,
    request: ReturnType<typeof buildRewriteRequest>,
  ): Promise<RewriteCompletion> => {
    const body = JSON.stringify(rung.model ? { ...request, model: rung.model } : request);
    let lastError: Error = new Error('không gọi được provider');

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 0) await sleep(retryDelay(attempt - 1, null));
      await takeSlot(rung);
      if (rung.remaining <= 0) throw new RungDeadError('hết hạn mức ngày theo bảng');
      rung.remaining -= 1;

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body,
          signal: AbortSignal.timeout(180_000),
        });
      } catch (cause) {
        lastError = new Error('lỗi mạng khi gọi provider', { cause });
        continue;
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        lastError = new Error(`provider trả HTTP ${response.status}: ${oneLine(detail).slice(0, 300)}`);

        if (response.status === 429) {
          if (quotaScope(detail) === 'day') {
            rung.remaining = 0;
            throw new RungDeadError(`429 hết hạn mức ngày, quotaId=${quotaIds(detail) || 'không rõ'}`);
          }
          // Vượt trần phút: chờ rồi gọi lại chính bậc này.
          if (!rateLimitWarned) {
            rateLimitWarned = true;
            console.warn(
              `rewrite chạm trần phút của ${rung.model ?? 'model mặc định'} ` +
                `(retry-after=${response.headers.get('retry-after') ?? 'none'})`,
            );
          }
          await sleep(retryDelay(attempt, response.headers.get('retry-after')));
          continue;
        }

        if (isModelUnavailable(response.status, detail)) {
          throw new RungDeadError(`HTTP ${response.status}: ${oneLine(detail).slice(0, 200)}`);
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
  };

  return {
    complete: async (request) => {
      for (;;) {
        const rung = usable();
        if (!rung) throw new RewriteQuotaError('hết hạn mức ngày ở mọi model trong thang');
        try {
          return await completeOn(rung, request);
        } catch (error) {
          if (!(error instanceof RungDeadError)) throw error;
          killRung(rung, error.why);
        }
      }
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
    if (error instanceof RewriteQuotaError) return { ok: false, reason: 'quota' };
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
