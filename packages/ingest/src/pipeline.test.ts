import { test, expect, afterEach } from 'vitest';
import { and, eq, like } from 'drizzle-orm';
import { createDb, articles, articleContents, ingestRuns } from '@news/db';
import type { FetchedArticle } from './newsdata.js';
import type { RewriteResult } from './rewrite.js';
import { runIngest, defaultConcurrency, type PipelineDeps } from './pipeline.js';

const db = createDb();
const createdRuns: string[] = [];

afterEach(async () => {
  await db.delete(articles).where(like(articles.sourceId, 'test-pipe-%'));
  for (const id of createdRuns.splice(0)) {
    await db.delete(ingestRuns).where(eq(ingestRuns.id, id));
  }
});

function fetched(overrides: Partial<FetchedArticle> = {}): FetchedArticle {
  return {
    sourceId: `test-pipe-${crypto.randomUUID()}`,
    title: `Rates decision ${crypto.randomUUID()}`,
    description: 'Short wire description.',
    link: 'https://example.com/a',
    imageUrl: 'https://example.com/a.jpg',
    sourceName: 'Reuters',
    category: 'business',
    publishedAt: new Date('2026-08-30T09:00:00Z'),
    ...overrides,
  };
}

const rewritten: RewriteResult = {
  ok: true,
  article: {
    title_vi: 'Ngân hàng trung ương giữ nguyên lãi suất',
    title_en: 'Central bank holds rates steady',
    summary_vi: 'Lãi suất không đổi.',
    summary_en: 'Rates unchanged.',
    body_vi: 'Đoạn một.\n\nĐoạn hai.',
    body_en: 'Paragraph one.\n\nParagraph two.',
    tags: ['lai-suat'],
    category: 'business',
  },
};

function deps(overrides: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    db,
    fetchCategory: async () => [fetched()],
    extract: async () => ({ text: 'x'.repeat(600) }),
    rewrite: async () => rewritten,
    ...overrides,
  };
}

async function run(d: PipelineDeps) {
  const result = await runIngest(d, { categories: ['business'] });
  createdRuns.push(result.runId);
  return result;
}

test('defaultConcurrency chừa biên an toàn cho provider free siết theo phút', () => {
  expect(defaultConcurrency('gemini')).toBeLessThan(defaultConcurrency('bai'));
});

test('a fetched article ends up written with both languages', async () => {
  const article = fetched();

  const result = await run(deps({ fetchCategory: async () => [article] }));

  expect(result.counters).toMatchObject({ fetched: 1, written: 1, failed: 0 });
  const [row] = await db.select().from(articles).where(eq(articles.sourceId, article.sourceId));
  expect(row!.sourceUrl).toBe(article.link);
  const contents = await db.select().from(articleContents).where(eq(articleContents.articleId, row!.id));
  expect(contents).toHaveLength(2);
  expect(contents.find((c) => c.lang === 'vi')!.title).toBe(rewritten.ok ? rewritten.article.title_vi : '');
});

test('an article already in the database is skipped before extraction', async () => {
  const article = fetched();
  await run(deps({ fetchCategory: async () => [article] }));

  let extractCalls = 0;
  const result = await run(
    deps({
      fetchCategory: async () => [article],
      extract: async () => {
        extractCalls += 1;
        return { text: 'x'.repeat(600) };
      },
    }),
  );

  expect(result.counters).toMatchObject({ fetched: 1, skippedDup: 1, written: 0 });
  expect(extractCalls).toBe(0);
});

test('a failed extraction never reaches the rewrite call', async () => {
  let rewriteCalls = 0;
  const result = await run(
    deps({
      extract: async () => null,
      rewrite: async () => {
        rewriteCalls += 1;
        return rewritten;
      },
    }),
  );

  expect(result.counters).toMatchObject({ skippedExtract: 1, written: 0 });
  expect(rewriteCalls).toBe(0);
});

test('a refused rewrite counts as failed and writes nothing', async () => {
  const article = fetched();

  const result = await run(
    deps({
      fetchCategory: async () => [article],
      rewrite: async () => ({ ok: false, reason: 'refusal' }),
    }),
  );

  expect(result.counters).toMatchObject({ failed: 1, written: 0 });
  const rows = await db.select().from(articles).where(eq(articles.sourceId, article.sourceId));
  expect(rows).toHaveLength(0);
});

test('one article throwing does not stop the others', async () => {
  const good = fetched();
  const bad = fetched();

  const result = await run(
    deps({
      fetchCategory: async () => [bad, good],
      extract: async (url, article) => {
        if (article.sourceId === bad.sourceId) throw new Error('boom');
        return { text: 'x'.repeat(600) };
      },
    }),
  );

  expect(result.counters).toMatchObject({ fetched: 2, written: 1, failed: 1 });
  const rows = await db.select().from(articles).where(eq(articles.sourceId, good.sourceId));
  expect(rows).toHaveLength(1);
});

test('the run row carries the final counters', async () => {
  const result = await run(deps());

  const [row] = await db.select().from(ingestRuns).where(eq(ingestRuns.id, result.runId));
  expect(row!.fetched).toBe(1);
  expect(row!.written).toBe(1);
  expect(row!.finishedAt).not.toBeNull();
});

test('the stored article keeps the category the rewrite settled on', async () => {
  const article = fetched({ category: 'top' });

  await run(
    deps({
      fetchCategory: async () => [article],
      rewrite: async () => ({ ...rewritten, article: { ...rewritten.article, category: 'technology' } } as RewriteResult),
    }),
  );

  const [row] = await db.select().from(articles).where(eq(articles.sourceId, article.sourceId));
  expect(row!.category).toBe('technology');
});

test('duplicates inside one fetch batch are only written once', async () => {
  const article = fetched();

  const result = await run(deps({ fetchCategory: async () => [article, { ...article, sourceId: `test-pipe-${crypto.randomUUID()}` }] }));

  expect(result.counters).toMatchObject({ fetched: 2, skippedDup: 1, written: 1 });
  const rows = await db
    .select()
    .from(articles)
    .where(and(eq(articles.sourceName, 'Reuters'), like(articles.sourceId, 'test-pipe-%')));
  expect(rows).toHaveLength(1);
});
