import { test, expect, vi } from 'vitest';
import { submitIndexNow, INDEXNOW_MAX_URLS, type IndexNowConfig } from './indexnow.js';

const config: IndexNowConfig = {
  host: 'tin-nhanh.vercel.app',
  key: 'abc123',
  endpoint: 'https://api.indexnow.org/indexnow',
};

function okFetch() {
  return vi.fn(async (_url: string, _init: RequestInit) => new Response(null, { status: 200 }));
}

test('does not call the endpoint when there is nothing to submit', async () => {
  const fetchMock = okFetch();

  const result = await submitIndexNow([], config, fetchMock);

  expect(fetchMock).not.toHaveBeenCalled();
  expect(result).toEqual({ submitted: 0, status: null, skipped: 'empty' });
});

test('does not call the endpoint when the key is missing', async () => {
  const fetchMock = okFetch();

  const result = await submitIndexNow(['https://tin-nhanh.vercel.app/vi/a'], { ...config, key: '' }, fetchMock);

  expect(fetchMock).not.toHaveBeenCalled();
  expect(result.skipped).toBe('no-key');
});

test('posts the url list as IndexNow json', async () => {
  const fetchMock = okFetch();

  const result = await submitIndexNow(
    ['https://tin-nhanh.vercel.app/vi/bai-mot', 'https://tin-nhanh.vercel.app/en/post-one'],
    config,
    fetchMock,
  );

  expect(result).toEqual({ submitted: 2, status: 200 });
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe('https://api.indexnow.org/indexnow');
  expect(init).toMatchObject({ method: 'POST' });
  expect(new Headers(init!.headers).get('content-type')).toBe('application/json; charset=utf-8');
  expect(JSON.parse(String(init!.body))).toEqual({
    host: 'tin-nhanh.vercel.app',
    key: 'abc123',
    keyLocation: 'https://tin-nhanh.vercel.app/abc123.txt',
    urlList: ['https://tin-nhanh.vercel.app/vi/bai-mot', 'https://tin-nhanh.vercel.app/en/post-one'],
  });
});

test('drops urls that belong to another host', async () => {
  const fetchMock = okFetch();

  const result = await submitIndexNow(
    ['https://tin-nhanh.vercel.app/vi/a', 'https://example.com/vi/b', 'not a url'],
    config,
    fetchMock,
  );

  expect(result.submitted).toBe(1);
  expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)).urlList).toEqual([
    'https://tin-nhanh.vercel.app/vi/a',
  ]);
});

test('sends each url once', async () => {
  const fetchMock = okFetch();

  const result = await submitIndexNow(
    ['https://tin-nhanh.vercel.app/vi/a', 'https://tin-nhanh.vercel.app/vi/a'],
    config,
    fetchMock,
  );

  expect(result.submitted).toBe(1);
});

test('caps a run at the protocol limit', async () => {
  const fetchMock = okFetch();
  const urls = Array.from(
    { length: INDEXNOW_MAX_URLS + 25 },
    (_, i) => `https://tin-nhanh.vercel.app/vi/bai-${i}`,
  );

  const result = await submitIndexNow(urls, config, fetchMock);

  expect(result.submitted).toBe(INDEXNOW_MAX_URLS);
  expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)).urlList).toHaveLength(INDEXNOW_MAX_URLS);
});

test('reports a rejected submission without throwing', async () => {
  const fetchMock = vi.fn(async () => new Response('bad key', { status: 403 }));

  const result = await submitIndexNow(['https://tin-nhanh.vercel.app/vi/a'], config, fetchMock);

  expect(result).toMatchObject({ status: 403, submitted: 0 });
});

// Ingest không được đỏ chỉ vì search engine chết — đây là bước phụ, best effort.
test('swallows a transport failure', async () => {
  const fetchMock = vi.fn(async () => {
    throw new Error('ECONNRESET');
  });

  const result = await submitIndexNow(['https://tin-nhanh.vercel.app/vi/a'], config, fetchMock);

  expect(result).toMatchObject({ status: null, submitted: 0 });
  expect(result.error).toContain('ECONNRESET');
});
