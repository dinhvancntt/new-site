import { afterAll, beforeAll, expect, test } from 'vitest';
import { like } from 'drizzle-orm';
import { articles, createDb, slugify } from '@news/db';
import { storeArticle, type StorableArticle } from '../../ingest/src/store.js';
import { getArticle, listByCategory, listLatest, searchArticles, siblingSlug } from './index.js';

const db = createDb();
const PREFIX = 'test-queries-';

function storable(over: {
  vi: string;
  en: string;
  category?: string;
  publishedAt?: Date;
  summaryVi?: string;
}): StorableArticle {
  return {
    sourceId: `${PREFIX}${crypto.randomUUID()}`,
    title: over.en,
    sourceName: 'Reuters',
    sourceUrl: 'https://example.com/a',
    imageUrl: 'https://example.com/a.jpg',
    category: over.category ?? 'world',
    publishedAt: over.publishedAt ?? new Date('2026-08-01T00:00:00Z'),
    model: 'claude-opus-5',
    contents: {
      vi: {
        title: over.vi,
        summary: over.summaryVi ?? 'Tóm tắt tiếng Việt.',
        body: 'Đoạn một.\n\nĐoạn hai.',
      },
      en: { title: over.en, summary: 'English summary.', body: 'Paragraph one.\n\nParagraph two.' },
    },
  };
}

// Ba bài cố định dùng chung cho cả tệp: dựng lại trước mỗi test sẽ tốn hàng
// chục giây gọi Neon mà không thêm độ tin cậy nào — không test nào ghi thêm.
const fixtures = [
  storable({
    vi: 'Bão số ba đổ bộ miền Trung',
    en: 'Typhoon makes landfall in central region',
    category: 'world',
    publishedAt: new Date('2026-08-28T00:00:00Z'),
  }),
  storable({
    vi: 'Ngân hàng trung ương hạ lãi suất điều hành',
    en: 'Central bank cuts its policy rate',
    category: 'business',
    publishedAt: new Date('2026-08-29T00:00:00Z'),
    summaryVi: 'Quyết định có hiệu lực từ tuần sau.',
  }),
  storable({
    vi: 'Hãng xe điện mở nhà máy mới',
    en: 'Carmaker opens a new plant',
    category: 'business',
    publishedAt: new Date('2026-08-30T00:00:00Z'),
  }),
];

beforeAll(async () => {
  for (const fixture of fixtures) await storeArticle(db, fixture);
});

afterAll(async () => {
  await db.delete(articles).where(like(articles.sourceId, `${PREFIX}%`));
});

function slugOf(fixture: StorableArticle, lang: 'vi' | 'en'): string {
  return slugify(fixture.contents[lang].title);
}

// Các tệp test khác cũng để lại bài trong cùng cơ sở dữ liệu, nên khẳng định về
// thứ tự danh sách chỉ có nghĩa khi lọc lại đúng ba bài của tệp này.
const fixtureSlugs = new Set(
  fixtures.flatMap((fixture) => [slugOf(fixture, 'vi'), slugOf(fixture, 'en')]),
);

function ours<T extends { slug: string }>(rows: T[]): T[] {
  return rows.filter((row) => fixtureSlugs.has(row.slug));
}

test('the latest list is newest first and carries what a card needs', async () => {
  const rows = ours(await listLatest(db, 'vi', { limit: 50 }));

  expect(rows.map((row) => row.title)).toEqual([
    'Hãng xe điện mở nhà máy mới',
    'Ngân hàng trung ương hạ lãi suất điều hành',
    'Bão số ba đổ bộ miền Trung',
  ]);
  expect(rows[0]).toMatchObject({
    category: 'business',
    sourceName: 'Reuters',
    summary: 'Tóm tắt tiếng Việt.',
  });
  expect(rows[0]!.imageUrl).toBe('https://example.com/a.jpg');
  expect(rows[0]!.publishedAt).toBeInstanceOf(Date);
});

test('a list only returns the language asked for', async () => {
  const rows = ours(await listLatest(db, 'en', { limit: 50 }));

  expect(rows[0]!.title).toBe('Carmaker opens a new plant');
});

test('a category list excludes other categories', async () => {
  const rows = ours(await listByCategory(db, 'vi', 'business', { limit: 50 }));

  expect(rows.map((row) => row.category)).toEqual(['business', 'business']);
  expect(rows.map((row) => row.title)).toEqual([
    'Hãng xe điện mở nhà máy mới',
    'Ngân hàng trung ương hạ lãi suất điều hành',
  ]);
});

test('paging skips the rows already shown', async () => {
  const first = await listLatest(db, 'vi', { limit: 50 });
  const second = await listLatest(db, 'vi', { limit: 50, offset: 1 });

  expect(second.map((row) => row.slug)).not.toContain(first[0]!.slug);
});

test('an article page gets the body and the attribution it must show', async () => {
  const article = await getArticle(db, 'vi', slugOf(fixtures[1]!, 'vi'));

  expect(article).toMatchObject({
    title: 'Ngân hàng trung ương hạ lãi suất điều hành',
    sourceName: 'Reuters',
    sourceUrl: 'https://example.com/a',
    category: 'business',
  });
  expect(article!.body).toContain('Đoạn một.');
  expect(article!.publishedAt.toISOString()).toBe('2026-08-29T00:00:00.000Z');
});

test('an unknown slug is not found rather than an error', async () => {
  expect(await getArticle(db, 'vi', 'khong-co-bai-nao-nhu-the-nay')).toBeNull();
});

test('a slug from the other language is not found', async () => {
  expect(await getArticle(db, 'vi', slugOf(fixtures[1]!, 'en'))).toBeNull();
});

test('the language switch finds the same article under its other slug', async () => {
  const article = await getArticle(db, 'vi', slugOf(fixtures[1]!, 'vi'));

  expect(await siblingSlug(db, article!.articleId, 'en')).toBe(slugOf(fixtures[1]!, 'en'));
});

test('search matches the language being read', async () => {
  const rows = await searchArticles(db, 'vi', 'lãi suất', { limit: 50 });

  expect(rows.map((row) => row.title)).toContain('Ngân hàng trung ương hạ lãi suất điều hành');
});

test('search ignores diacritics so a keyboard without dấu still finds the article', async () => {
  const rows = await searchArticles(db, 'vi', 'lai suat', { limit: 50 });

  expect(rows.map((row) => row.title)).toContain('Ngân hàng trung ương hạ lãi suất điều hành');
});

test('search reaches words that only appear in the summary', async () => {
  const rows = await searchArticles(db, 'vi', 'hiệu lực', { limit: 50 });

  expect(rows.map((row) => row.title)).toContain('Ngân hàng trung ương hạ lãi suất điều hành');
});

test('search with no match returns nothing rather than everything', async () => {
  expect(await searchArticles(db, 'vi', 'zzzkhongtontai', { limit: 50 })).toEqual([]);
});

test('an empty query returns nothing rather than the whole table', async () => {
  expect(await searchArticles(db, 'vi', '   ', { limit: 50 })).toEqual([]);
});
