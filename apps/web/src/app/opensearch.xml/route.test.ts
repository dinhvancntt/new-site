import { test, expect } from 'vitest';
import { GET } from './route.js';

test('search template targets the English search page', async () => {
  const body = await GET().text();

  expect(body).not.toContain('/vi/');
  expect(body).toContain('/en/search?q={searchTerms}');
});
