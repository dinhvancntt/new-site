import { test, expect, afterEach } from 'vitest';
import { GET } from './route.js';

const original = process.env['INDEXNOW_KEY'];

afterEach(() => {
  if (original === undefined) delete process.env['INDEXNOW_KEY'];
  else process.env['INDEXNOW_KEY'] = original;
});

test('serves the raw key as plain text', async () => {
  process.env['INDEXNOW_KEY'] = 'abc123';

  const response = GET();

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  expect(await response.text()).toBe('abc123');
});

test('404s when no key is configured, rather than serving an empty file', async () => {
  delete process.env['INDEXNOW_KEY'];

  const response = GET();

  expect(response.status).toBe(404);
});
