import { test, expect } from 'vitest';
import { buildRewriteRequest, rewriteArticle, type RewriteInput } from './rewrite.js';

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
