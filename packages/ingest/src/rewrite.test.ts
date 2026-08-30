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

function parserReturning(message: { stop_reason: string; parsed_output?: unknown }) {
  return async () => message as never;
}

test('request pins model, token ceiling and effort from the spec', () => {
  const request = buildRewriteRequest(input);

  expect(request.model).toBe('claude-opus-5');
  expect(request.max_tokens).toBe(8000);
  expect(request.thinking).toEqual({ type: 'adaptive' });
  expect(request.output_config.effort).toBe('medium');
});

test('request enables the refusal fallback chain', () => {
  const request = buildRewriteRequest(input);

  expect(request.betas).toContain('server-side-fallback-2026-07-01');
  expect(request.fallbacks).toBe('default');
});

test('system prompt is cached and carries the anti-fabrication rules', () => {
  const request = buildRewriteRequest(input);
  const [systemBlock] = request.system;

  expect(systemBlock!.cache_control).toEqual({ type: 'ephemeral' });
  expect(systemBlock!.text).toMatch(/chỉ dùng dữ kiện/i);
  expect(systemBlock!.text).not.toContain(input.title);
});

test('article body travels in the user message, not the cached system prompt', () => {
  const request = buildRewriteRequest(input);
  const userContent = request.messages[0]!.content;

  expect(userContent).toContain('The central bank kept its benchmark rate unchanged');
  expect(userContent).toContain('Reuters');
});

test('returns the rewritten article with the category from the fetch stage', async () => {
  const result = await rewriteArticle(input, {
    parse: parserReturning({ stop_reason: 'end_turn', parsed_output: goodOutput }),
  });

  expect(result.ok).toBe(true);
  expect(result.ok && result.article.title_vi).toBe('Ngân hàng trung ương giữ nguyên lãi suất');
  expect(result.ok && result.article.category).toBe('business');
});

test('drops the article when the model reports insufficient facts', async () => {
  const result = await rewriteArticle(input, {
    parse: parserReturning({ stop_reason: 'end_turn', parsed_output: { ...goodOutput, insufficient: true } }),
  });

  expect(result).toEqual({ ok: false, reason: 'insufficient' });
});

test('drops the article on refusal without reading content', async () => {
  const result = await rewriteArticle(input, {
    parse: parserReturning({ stop_reason: 'refusal' }),
  });

  expect(result).toEqual({ ok: false, reason: 'refusal' });
});

test('reports an error when the API call throws', async () => {
  const result = await rewriteArticle(input, {
    parse: async () => {
      throw new Error('overloaded');
    },
  });

  expect(result).toEqual({ ok: false, reason: 'error' });
});
