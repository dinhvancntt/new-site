import { test, expect, afterEach } from 'vitest';
import { and, eq, like } from 'drizzle-orm';
import { createDb, articles, articleContents, ingestRuns } from '@news/db';
import { storeArticle, startRun, finishRun, type StorableArticle } from './store.js';

const db = createDb();

afterEach(async () => {
  await db.delete(articles).where(like(articles.sourceId, 'test-store-%'));
});

function storable(overrides: Partial<StorableArticle> = {}): StorableArticle {
  return {
    sourceId: `test-store-${crypto.randomUUID()}`,
    title: 'Central bank holds rates steady',
    sourceName: 'Reuters',
    sourceUrl: 'https://example.com/a',
    imageUrl: 'https://example.com/a.jpg',
    category: 'business',
    publishedAt: new Date('2026-08-30T09:00:00Z'),
    model: 'claude-opus-5',
    contents: {
      vi: {
        title: 'Ngân hàng trung ương giữ nguyên lãi suất',
        summary: 'Lãi suất điều hành không đổi trong cuộc họp tháng Tám.',
        body: 'Đoạn một.\n\nĐoạn hai.',
      },
      en: {
        title: 'Central bank holds rates steady',
        summary: 'The benchmark rate was left unchanged in August.',
        body: 'Paragraph one.\n\nParagraph two.',
      },
    },
    ...overrides,
  };
}

test('writes the article and both language contents', async () => {
  const input = storable();

  const id = await storeArticle(db, input);

  const [row] = await db.select().from(articles).where(eq(articles.id, id!));
  expect(row!.sourceName).toBe('Reuters');
  expect(row!.category).toBe('business');
  expect(row!.publishedAt.toISOString()).toBe('2026-08-30T09:00:00.000Z');

  const contents = await db.select().from(articleContents).where(eq(articleContents.articleId, id!));
  expect(contents.map((c) => c.lang).sort()).toEqual(['en', 'vi']);
  expect(contents.find((c) => c.lang === 'vi')!.title).toBe(input.contents.vi.title);
});

test('slug is derived from the title of its own language', async () => {
  const id = await storeArticle(db, storable());

  const contents = await db.select().from(articleContents).where(eq(articleContents.articleId, id!));
  expect(contents.find((c) => c.lang === 'vi')!.slug).toContain('ngan-hang-trung-uong-giu-nguyen-lai-suat');
  expect(contents.find((c) => c.lang === 'en')!.slug).toContain('central-bank-holds-rates-steady');
});

test('search_text is lowercase and diacritic-free', async () => {
  const id = await storeArticle(db, storable());

  const contents = await db.select().from(articleContents).where(eq(articleContents.articleId, id!));
  const vi = contents.find((c) => c.lang === 'vi')!;
  expect(vi.searchText).toContain('ngan hang trung uong giu nguyen lai suat');
  expect(vi.searchText).toContain('lai suat dieu hanh khong doi');
  expect(vi.searchText).not.toMatch(/[àáâãèéêìíòóôõùúăđĩũơư]/);
});

test('titles that differ only by diacritics still get distinct slugs', async () => {
  const withMarks = storable({ title: 'Gold price surges', contents: { ...storable().contents, vi: { title: 'Giá vàng tăng mạnh', summary: 'Tóm tắt.', body: 'Thân bài.' } } });
  const withoutMarks = storable({ title: 'Gold rate surges', contents: { ...storable().contents, vi: { title: 'Gia vang tang manh', summary: 'Tom tat.', body: 'Than bai.' } } });

  const first = await storeArticle(db, withMarks);
  const second = await storeArticle(db, withoutMarks);
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();

  const [a] = await db
    .select()
    .from(articleContents)
    .where(and(eq(articleContents.articleId, first!), eq(articleContents.lang, 'vi')));
  const [b] = await db
    .select()
    .from(articleContents)
    .where(and(eq(articleContents.articleId, second!), eq(articleContents.lang, 'vi')));
  expect(a!.slug).toBe('gia-vang-tang-manh');
  expect(b!.slug).not.toBe(a!.slug);
});

test('a duplicate source_id writes nothing at all', async () => {
  const input = storable();
  await storeArticle(db, input);

  const second = await storeArticle(db, { ...input, contents: input.contents });

  expect(second).toBeNull();
  const rows = await db.select().from(articles).where(eq(articles.sourceId, input.sourceId));
  expect(rows).toHaveLength(1);
});

test('run log records counters from start to finish', async () => {
  const runId = await startRun(db);
  await finishRun(db, runId, { fetched: 10, skippedDup: 3, skippedExtract: 2, written: 4, failed: 1 });

  const [run] = await db.select().from(ingestRuns).where(eq(ingestRuns.id, runId));
  expect(run!.fetched).toBe(10);
  expect(run!.written).toBe(4);
  expect(run!.finishedAt).not.toBeNull();
  await db.delete(ingestRuns).where(eq(ingestRuns.id, runId));
});
