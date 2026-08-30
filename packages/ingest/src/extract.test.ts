import { test, expect } from 'vitest';
import { extractArticle, MIN_BODY_LENGTH } from './extract.js';

const paragraph = 'Cơ quan chức năng cho biết vụ việc xảy ra vào sáng thứ Hai. '.repeat(12);

function pageWith(body: string): string {
  return `<!DOCTYPE html><html><head><title>Test Article</title></head>
    <body><nav>menu links here</nav>
    <article><h1>Test Article</h1><p>${body}</p></article>
    <footer>copyright</footer></body></html>`;
}

function fetchReturning(html: string, status = 200): typeof fetch {
  return (async () =>
    new Response(html, { status, headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;
}

test('extracts article body text from page HTML', async () => {
  const result = await extractArticle('https://example.com/a', { fetchImpl: fetchReturning(pageWith(paragraph)) });

  expect(result).not.toBeNull();
  expect(result!.text).toContain('Cơ quan chức năng cho biết');
  expect(result!.text.length).toBeGreaterThanOrEqual(MIN_BODY_LENGTH);
});

test('strips navigation and footer chrome from extracted text', async () => {
  const result = await extractArticle('https://example.com/a', { fetchImpl: fetchReturning(pageWith(paragraph)) });

  expect(result!.text).not.toContain('menu links here');
  expect(result!.text).not.toContain('copyright');
});

test('returns null when body is shorter than the minimum length', async () => {
  const result = await extractArticle('https://example.com/a', { fetchImpl: fetchReturning(pageWith('Quá ngắn.')) });

  expect(result).toBeNull();
});

test('returns null when the page cannot be fetched', async () => {
  const result = await extractArticle('https://example.com/paywall', {
    fetchImpl: fetchReturning('<html><body>403</body></html>', 403),
  });

  expect(result).toBeNull();
});

test('returns null when the request throws', async () => {
  const failing = (async () => {
    throw new Error('ECONNRESET');
  }) as unknown as typeof fetch;

  const result = await extractArticle('https://example.com/a', { fetchImpl: failing });

  expect(result).toBeNull();
});
