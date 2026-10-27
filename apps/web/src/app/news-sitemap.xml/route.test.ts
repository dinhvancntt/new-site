import { test, expect, vi, beforeEach } from 'vitest';

const listLatest = vi.fn();

vi.mock('@news/queries', () => ({ listLatest: (...args: unknown[]) => listLatest(...args) }));
vi.mock('@/lib/db', () => ({ getDb: () => ({}) }));

const { GET } = await import('./route.js');

beforeEach(() => {
  listLatest.mockReset();
  listLatest.mockResolvedValue([
    { slug: 'a-story', title: 'A story', publishedAt: new Date() },
  ]);
});

test('submits only the language still published', async () => {
  await GET();

  const langs = listLatest.mock.calls.map((call) => call[1]);
  expect(langs).toEqual(['en']);
});

test('never lists a URL that redirects', async () => {
  const xml = await (await GET()).text();

  expect(xml).not.toContain('/vi/');
  expect(xml).toContain('/en/a-story');
});
