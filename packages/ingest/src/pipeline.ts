import { inArray } from 'drizzle-orm';
import { articles, type Db } from '@news/db';
import { selectNewArticles, titleHash, type ExistingKeys } from './dedupe.js';
import type { ExtractedArticle } from './extract.js';
import type { FetchedArticle } from './newsdata.js';
import type { RewriteResult } from './rewrite.js';
import { finishRun, startRun, storeArticle } from './store.js';
import type { RunCounters } from './store.js';

export type PipelineDeps = {
  db: Db;
  fetchCategory: (category: string) => Promise<FetchedArticle[]>;
  extract: (url: string, article: FetchedArticle) => Promise<ExtractedArticle | null>;
  rewrite: (input: {
    title: string;
    body: string;
    sourceName: string;
    category: string;
  }) => Promise<RewriteResult>;
};

export type PipelineOptions = {
  categories: string[];
  /** Số bài viết lại song song — mỗi bài là một lần gọi model tốn nhiều giây. */
  concurrency?: number;
};

export type IngestResult = { runId: string; counters: RunCounters };

const DEFAULT_CONCURRENCY = 3;

/** Chỉ tra những khoá thực sự vừa lấy về, thay vì kéo toàn bộ bảng. */
async function loadExistingKeys(db: Db, candidates: FetchedArticle[]): Promise<ExistingKeys> {
  if (candidates.length === 0) return { sourceIds: new Set(), titleHashes: new Set() };

  const rows = await db
    .select({ sourceId: articles.sourceId, titleHash: articles.titleHash })
    .from(articles)
    .where(
      inArray(
        articles.sourceId,
        candidates.map((c) => c.sourceId),
      ),
    );
  const byTitle = await db
    .select({ titleHash: articles.titleHash })
    .from(articles)
    .where(
      inArray(
        articles.titleHash,
        candidates.map((c) => titleHash(c.title)),
      ),
    );

  return {
    sourceIds: new Set(rows.map((r) => r.sourceId)),
    titleHashes: new Set([...rows, ...byTitle].map((r) => r.titleHash)),
  };
}

/** Chạy các tác vụ theo pool cố định, giữ nguyên thứ tự đầu vào. */
async function forEachLimited<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export async function runIngest(
  deps: PipelineDeps,
  options: PipelineOptions,
): Promise<IngestResult> {
  const runId = await startRun(deps.db);
  const counters: RunCounters = {
    fetched: 0,
    skippedDup: 0,
    skippedExtract: 0,
    written: 0,
    failed: 0,
  };

  const candidates: FetchedArticle[] = [];
  for (const category of options.categories) {
    try {
      candidates.push(...(await deps.fetchCategory(category)));
    } catch {
      counters.failed += 1;
    }
  }
  counters.fetched = candidates.length;

  const existing = await loadExistingKeys(deps.db, candidates);
  const fresh = selectNewArticles(candidates, existing);
  counters.skippedDup = candidates.length - fresh.length;

  await forEachLimited(fresh, options.concurrency ?? DEFAULT_CONCURRENCY, async (article) => {
    try {
      const extracted = await deps.extract(article.link, article);
      if (!extracted) {
        counters.skippedExtract += 1;
        return;
      }

      const result = await deps.rewrite({
        title: article.title,
        body: extracted.text,
        sourceName: article.sourceName,
        category: article.category,
      });
      if (!result.ok) {
        counters.failed += 1;
        return;
      }

      const stored = await storeArticle(deps.db, {
        sourceId: article.sourceId,
        title: article.title,
        sourceName: article.sourceName,
        sourceUrl: article.link,
        imageUrl: article.imageUrl,
        category: result.article.category,
        publishedAt: article.publishedAt,
        model: 'claude-opus-5',
        contents: {
          vi: {
            title: result.article.title_vi,
            summary: result.article.summary_vi,
            body: result.article.body_vi,
          },
          en: {
            title: result.article.title_en,
            summary: result.article.summary_en,
            body: result.article.body_en,
          },
        },
      });

      if (stored) counters.written += 1;
      else counters.skippedDup += 1;
    } catch {
      // Một bài hỏng không được kéo cả mẻ xuống — xem spec Bước 6.
      counters.failed += 1;
    }
  });

  await finishRun(deps.db, runId, counters);
  return { runId, counters };
}
