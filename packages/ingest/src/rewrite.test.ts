import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  GEMINI_BASE_URL,
  GEMINI_MODEL,
  buildRewriteRequest,
  budgetFor,
  CONSERVATIVE_LIMIT,
  createRewriteClient,
  DEFAULT_MODEL_LADDER,
  ladderBudget,
  resolveModelLadder,
  RewriteQuotaError,
  paceIntervalMs,
  resolveRewriteConfig,
  rewriteArticle,
  type RewriteInput,
} from './rewrite.js';

const input: RewriteInput = {
  title: 'Central bank holds rates steady',
  body: 'The central bank kept its benchmark rate unchanged on Monday. '.repeat(20),
  sourceName: 'Reuters',
  category: 'business',
};

const goodOutput = {
  title_vi: 'Ngân hàng trung ương giữ nguyên lãi suất',
  title_en: 'Central bank holds rates steady',
  summary_vi: 'Tóm tắt tiếng Việt.',
  summary_en: 'English summary.',
  body_vi: 'Đoạn một.\n\nĐoạn hai.',
  body_en: 'Paragraph one.\n\nParagraph two.',
  tags: ['lãi suất', 'ngân hàng'],
  insufficient: false,
};

function completerReturning(message: { finish_reason: string | null; text: string }) {
  return async () => message;
}

function completerWithJson(output: unknown) {
  return completerReturning({ finish_reason: 'stop', text: JSON.stringify(output) });
}

test('request pins the b.ai model, token ceiling and JSON mode', () => {
  const request = buildRewriteRequest(input);

  expect(request.model).toBe('deepseek-v4-flash');
  expect(request.max_tokens).toBe(8000);
  expect(request.response_format).toEqual({ type: 'json_object' });
});

test('request carries a custom model when the caller overrides it', () => {
  expect(buildRewriteRequest(input, 'gemini-2.5-flash').model).toBe('gemini-2.5-flash');
});

test('provider defaults to b.ai when REWRITE_PROVIDER is unset', () => {
  expect(resolveRewriteConfig({})).toMatchObject({ provider: 'bai' });
});

test('provider switches to Gemini with model and base URL defaults', () => {
  const config = resolveRewriteConfig({ REWRITE_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key' });

  expect(config).toMatchObject({
    provider: 'gemini',
    apiKey: 'test-key',
    baseUrl: GEMINI_BASE_URL,
    model: GEMINI_MODEL,
  });
});

test('provider value tolerates case and surrounding whitespace from UI paste', () => {
  expect(resolveRewriteConfig({ REWRITE_PROVIDER: ' Gemini ' }).provider).toBe('gemini');
  expect(resolveRewriteConfig({ REWRITE_PROVIDER: 'GEMINI' }).provider).toBe('gemini');
  expect(resolveRewriteConfig({ REWRITE_PROVIDER: 'bai' }).provider).toBe('bai');
});

test('provider falls back to Gemini when its key exists without explicit setting', () => {
  expect(resolveRewriteConfig({ GEMINI_API_KEY: 'test-key' }).provider).toBe('gemini');
});

test('explicit bai wins even when a Gemini key exists', () => {
  const config = resolveRewriteConfig({ REWRITE_PROVIDER: 'bai', GEMINI_API_KEY: 'test-key' });
  expect(config.provider).toBe('bai');
});

test('provider honours GEMINI_MODEL and GEMINI_BASE_URL overrides', () => {
  const config = resolveRewriteConfig({
    REWRITE_PROVIDER: 'gemini',
    GEMINI_MODEL: 'gemini-3-flash',
    GEMINI_BASE_URL: 'https://example.com/openai',
  });

  expect(config.model).toBe('gemini-3-flash');
  expect(config.baseUrl).toBe('https://example.com/openai');
});

test('system message carries the anti-fabrication rules without the article', () => {
  const request = buildRewriteRequest(input);
  const [systemMessage] = request.messages;

  expect(systemMessage!.role).toBe('system');
  expect(systemMessage!.content).toMatch(/chỉ dùng dữ kiện/i);
  expect(systemMessage!.content).not.toContain(input.title);
});

test('system message names every field the JSON must carry', () => {
  const [systemMessage] = buildRewriteRequest(input).messages;

  for (const field of ['title_vi', 'title_en', 'summary_vi', 'summary_en', 'body_vi', 'body_en', 'tags', 'insufficient']) {
    expect(systemMessage!.content).toContain(field);
  }
});

test('article body travels in the user message, not the system prompt', () => {
  const request = buildRewriteRequest(input);
  const userMessage = request.messages[1];

  expect(userMessage!.role).toBe('user');
  expect(userMessage!.content).toContain('The central bank kept its benchmark rate unchanged');
  expect(userMessage!.content).toContain('Reuters');
});

test('returns the rewritten article with the category from the fetch stage', async () => {
  const result = await rewriteArticle(input, { complete: completerWithJson(goodOutput) });

  expect(result.ok).toBe(true);
  expect(result.ok && result.article.title_vi).toBe('Ngân hàng trung ương giữ nguyên lãi suất');
  expect(result.ok && result.article.category).toBe('business');
});

test('accepts JSON wrapped in a markdown fence', async () => {
  const fenced = '```json\n' + JSON.stringify(goodOutput) + '\n```';
  const result = await rewriteArticle(input, {
    complete: completerReturning({ finish_reason: 'stop', text: fenced }),
  });

  expect(result.ok).toBe(true);
  expect(result.ok && result.article.body_en).toBe('Paragraph one.\n\nParagraph two.');
});

test('drops the article when the model reports insufficient facts', async () => {
  const result = await rewriteArticle(input, {
    complete: completerWithJson({ ...goodOutput, insufficient: true }),
  });

  expect(result).toEqual({ ok: false, reason: 'insufficient' });
});

test('reports refusal when the provider trips its content filter', async () => {
  const result = await rewriteArticle(input, {
    complete: completerReturning({ finish_reason: 'content_filter', text: '' }),
  });

  expect(result).toEqual({ ok: false, reason: 'refusal' });
});

test('reports an error when reasoning ate the budget and left no text', async () => {
  const result = await rewriteArticle(input, {
    complete: completerReturning({ finish_reason: 'length', text: '' }),
  });

  expect(result).toEqual({ ok: false, reason: 'error' });
});

test('reports an error when the answer is truncated mid-JSON', async () => {
  const result = await rewriteArticle(input, {
    complete: completerReturning({
      finish_reason: 'length',
      text: '{"title_vi":"Ngân hàng trung ương giữ nguy',
    }),
  });

  expect(result).toEqual({ ok: false, reason: 'error' });
});

test('reports an error when the JSON is missing a required field', async () => {
  const { body_vi: _drop, ...missing } = goodOutput;
  const result = await rewriteArticle(input, { complete: completerWithJson(missing) });

  expect(result).toEqual({ ok: false, reason: 'error' });
});

test('reports an error when a required field carries the wrong type', async () => {
  const result = await rewriteArticle(input, {
    complete: completerWithJson({ ...goodOutput, tags: 'lãi suất' }),
  });

  expect(result).toEqual({ ok: false, reason: 'error' });
});

test('reports an error when the model returns prose instead of JSON', async () => {
  const result = await rewriteArticle(input, {
    complete: completerReturning({ finish_reason: 'stop', text: 'Tôi không thể viết lại bài này.' }),
  });

  expect(result).toEqual({ ok: false, reason: 'error' });
});

test('reports an error when the API call throws', async () => {
  const result = await rewriteArticle(input, {
    complete: async () => {
      throw new Error('overloaded');
    },
  });

  expect(result).toEqual({ ok: false, reason: 'error' });
});

// --- Quota free tier: 5 RPM / 20 RPD (Gemini 3.6 Flash) ---

describe('client trước trần quota', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const req = buildRewriteRequest(
    { title: 't', body: 'x'.repeat(600), sourceName: 'Reuters', category: 'world' },
    'gemini-3.6-flash',
  );

  test('429 báo hết quota chứ không thử lại — retry chỉ đốt thêm request', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('{"error":{"code":429,"message":"quota exceeded"}}', { status: 429 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createRewriteClient('k', 'https://p/v1');
    const result = await rewriteArticle(
      { title: 't', body: 'x'.repeat(600), sourceName: 'Reuters', category: 'world' },
      client,
    );

    expect(result).toEqual({ ok: false, reason: 'quota' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('giãn nhịp giữa hai lần gọi để nằm dưới trần request/phút', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{}' } }] }),
      ),
    );

    const client = createRewriteClient('k', 'https://p/v1', 150);
    const startedAt = Date.now();
    await client.complete(req);
    await client.complete(req);

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(140);
  });
});

describe('nhịp gọi và budget suy ra từ trần model', () => {
  test('3.6 Flash: 5 RPM / 20 RPD', () => {
    expect(paceIntervalMs('gemini-3.6-flash')).toBeGreaterThanOrEqual(12_000);
    expect(budgetFor('gemini-3.6-flash')).toBe(18);
  });

  test('3.5 Flash Lite: 15 RPM / 500 RPD nên chạy được cả mẻ 50 bài', () => {
    expect(paceIntervalMs('gemini-3.5-flash-lite')).toBeLessThanOrEqual(4_500);
    expect(budgetFor('gemini-3.5-flash-lite')).toBeGreaterThanOrEqual(50);
  });

  test('model lạ thì lấy trần chặt nhất', () => {
    expect(budgetFor('gemini-9-experimental')).toBe(18);
  });

  test('env ghi đè được budget', () => {
    expect(budgetFor('gemini-3.5-flash-lite', '12')).toBe(12);
    expect(budgetFor('gemini-3.5-flash-lite', 'rác')).toBe(450);
  });
});

test('biến rỗng từ Actions không được ghi đè model và base URL', () => {
  // Biến repo chưa đặt thì runner truyền chuỗi rỗng, không phải undefined.
  const config = resolveRewriteConfig({
    GEMINI_API_KEY: 'k',
    GEMINI_MODEL: '',
    GEMINI_BASE_URL: '   ',
  });

  expect(config.model).toBe(GEMINI_MODEL);
  expect(config.baseUrl).toBe(GEMINI_BASE_URL);
});

// Body 429 thật của Gemini: lý do nằm trong details[].violations[].quotaId,
// phân biệt được vượt-phút với vượt-ngày.
function quota429(quotaId: string, retryAfter?: string): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message: 'You exceeded your current quota, please check your plan and billing details.',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [
              {
                quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
                quotaId,
              },
            ],
          },
        ],
      },
    }),
    { status: 429, headers: retryAfter ? { 'retry-after': retryAfter } : {} },
  );
}

const okResponse = () =>
  Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{}' } }] });

/** Model của từng request đã bắn đi, theo đúng thứ tự. */
function modelsSent(mock: { mock: { calls: unknown[][] } }): string[] {
  return mock.mock.calls.map((call) => JSON.parse(String((call[1] as RequestInit).body)).model);
}

describe('thang model dự phòng', () => {
  const req = buildRewriteRequest(input, 'bac-1');

  test('thang mặc định xếp từ chất lượng cao xuống hạn mức cao', () => {
    const rungs = resolveModelLadder({});

    expect(rungs.map((rung) => rung.model)).toEqual(DEFAULT_MODEL_LADDER);
    expect(rungs[0]).toMatchObject({ model: 'gemini-3.6-flash', rpm: 5, rpd: 20 });
    expect(rungs.at(-1)).toMatchObject({ rpm: 15, rpd: 500 });
  });

  test('GEMINI_MODELS ghi đè thang, model lạ lấy hạn mức chặt nhất', () => {
    const rungs = resolveModelLadder({ GEMINI_MODELS: 'gemini-3.5-flash-lite, model-la ' });

    expect(rungs).toEqual([
      { model: 'gemini-3.5-flash-lite', rpm: 15, rpd: 500 },
      { model: 'model-la', ...CONSERVATIVE_LIMIT },
    ]);
  });

  test('budget là tổng hạn mức ngày của cả thang', () => {
    expect(ladderBudget(resolveModelLadder({}))).toBe(18 + 18 + 18 + 450 + 450);
  });

  test('hết quota ngày thì viết lại cùng bài bằng model bậc dưới', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(quota429('GenerateRequestsPerDayPerProjectPerModel-FreeTier'))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const client = createRewriteClient('k', 'https://p/v1', [
      { model: 'bac-1', rpm: 600, rpd: 20 },
      { model: 'bac-2', rpm: 600, rpd: 500 },
    ]);
    await client.complete(req);

    expect(modelsSent(fetchMock)).toEqual(['bac-1', 'bac-2']);
  });

  test('vượt trần phút thì chờ rồi gọi lại chính model đó, không tụt bậc', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(quota429('GenerateRequestsPerMinutePerProjectPerModel-FreeTier', '0'))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const client = createRewriteClient('k', 'https://p/v1', [
      { model: 'bac-1', rpm: 600, rpd: 20 },
      { model: 'bac-2', rpm: 600, rpd: 500 },
    ]);
    await client.complete(req);

    expect(modelsSent(fetchMock)).toEqual(['bac-1', 'bac-1']);
  });

  test('model không tồn tại cũng tụt bậc thay vì làm hỏng cả run', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('{"error":{"code":404,"message":"models/go-sai is not found","status":"NOT_FOUND"}}', {
          status: 404,
        }),
      )
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const client = createRewriteClient('k', 'https://p/v1', [
      { model: 'go-sai', rpm: 600, rpd: 20 },
      { model: 'bac-2', rpm: 600, rpd: 500 },
    ]);
    await client.complete(req);

    expect(modelsSent(fetchMock)).toEqual(['go-sai', 'bac-2']);
  });

  test('chạm hạn mức ngày của một bậc thì tự tụt, không cần đợi 429', async () => {
    const fetchMock = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const client = createRewriteClient('k', 'https://p/v1', [
      { model: 'bac-1', rpm: 600, rpd: 3 },
      { model: 'bac-2', rpm: 600, rpd: 500 },
    ]);
    for (let i = 0; i < 4; i += 1) await client.complete(req);

    expect(modelsSent(fetchMock)).toEqual(['bac-1', 'bac-1', 'bac-2', 'bac-2']);
  });

  test('hết cả thang mới báo hết quota', async () => {
    const fetchMock = vi.fn(async () =>
      quota429('GenerateRequestsPerDayPerProjectPerModel-FreeTier'),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createRewriteClient('k', 'https://p/v1', [
      { model: 'bac-1', rpm: 600, rpd: 20 },
      { model: 'bac-2', rpm: 600, rpd: 500 },
    ]);

    await expect(client.complete(req)).rejects.toBeInstanceOf(RewriteQuotaError);
    expect(modelsSent(fetchMock)).toEqual(['bac-1', 'bac-2']);
  });
});
