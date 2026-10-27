import { test, expect } from 'vitest';
import { GET } from './route.js';

test('points every link at the English site, not the retired /vi tree', async () => {
  const body = await GET().text();

  expect(body).not.toContain('/vi/');
  expect(body).toContain('/en/archive');
  expect(body).toContain('/en/rss.xml');
  expect(body).toContain('/en/c/world');
});
