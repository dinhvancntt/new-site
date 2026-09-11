import { inArray } from 'drizzle-orm';
import { articles, articleContents, type Db } from '@news/db';
import { selectNewArticles, titleHash, type ExistingKeys } from './dedupe.js';
import type { ExtractedArticle } from './extract.js';
import type { FetchedArticle } from './newsdata.js';
import type { RewriteProvider, RewriteResult } from './rewrite.js';
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
  /**
   * Trần số bài gọi model trong một run, để không vượt quota ngày của free
   * tier. Bài dư nằm lại nguồn và vào lượt chạy sau.
   */
  maxRewrites?: number;
};

/**
 * `skipped` là những bài chủ động không gọi model (hết budget/hết quota) —
 * tách khỏi `counters.failed` vì đó là vận hành bình thường, không phải run
 * hỏng, nên không được kéo workflow sang đỏ.
 */
export type IngestResult = {
  runId: string;
  counters: RunCounters;
  skipped: { budget: number; quota: number };
  /**
   * Đường dẫn tương đối (`/vi/<slug>`) của đúng những bài run này vừa ghi —
   * nguồn cho bước báo IndexNow. Bài trùng không có mặt ở đây vì nó không mới.
   */
  writtenPaths: string[];
};

const DEFAULT_CONCURRENCY = 3;

/**
 * Số luồng viết lại mặc định theo provider. Quota free của Gemini siết theo
 * request/phút (con số thay đổi theo model/tài khoản — xem panel quota trong
 * AI Studio, không hardcode ở đây): chạy 2 luồng, mỗi bài ~20-40 giây thì
 * ~3-6 request/phút, nằm dưới trần mà vẫn xong ~30 bài trong ~10 phút.
 */
export function defaultConcurrency(provider: RewriteProvider): number {
  return provider === 'gemini' ? 2 : DEFAULT_CONCURRENCY;
}

/** Cắt ngắn thông điệp lỗi để log diagnostics không phình. */
function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, 200);
}

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

  const storedIds: string[] = [];
  const candidates: FetchedArticle[] = [];
  // Gom lỗi theo giai đoạn để log một dòng diagnostics cuối run — trước đây
  // catch nuốt lỗi nên Actions chỉ thấy counters mà không biết vì sao fail.
  const fetchErrors: Record<string, string> = {};
  const rewriteReasons: Record<string, number> = {};
  const sampleErrors: string[] = [];
  for (const category of options.categories) {
    try {
      candidates.push(...(await deps.fetchCategory(category)));
    } catch (error) {
      counters.failed += 1;
      fetchErrors[category] = errorMessage(error);
    }
  }
  counters.fetched = candidates.length;

  const existing = await loadExistingKeys(deps.db, candidates);
  const fresh = selectNewArticles(candidates, existing);
  counters.skippedDup = candidates.length - fresh.length;

  const skipped = { budget: 0, quota: 0 };
  // Đếm số bài đã nhận suất gọi model; kiểm trước khi extract để không tốn
  // lượt tải trang cho bài chắc chắn không được viết lại.
  let granted = 0;
  let quotaExhausted = false;

  await forEachLimited(fresh, options.concurrency ?? DEFAULT_CONCURRENCY, async (article) => {
    try {
      if (quotaExhausted) {
        skipped.quota += 1;
        return;
      }
      if (options.maxRewrites !== undefined && granted >= options.maxRewrites) {
        skipped.budget += 1;
        return;
      }
      granted += 1;

      const extracted = await deps.extract(article.link, article);
      if (!extracted) {
        counters.skippedExtract += 1;
        // Không gọi model thì trả lại suất cho bài sau.
        granted -= 1;
        return;
      }

      const result = await deps.rewrite({
        title: article.title,
        body: extracted.text,
        sourceName: article.sourceName,
        category: article.category,
      });
      if (!result.ok) {
        rewriteReasons[result.reason] = (rewriteReasons[result.reason] ?? 0) + 1;
        if (result.reason === 'quota') {
          // Trần theo ngày: những bài sau cũng sẽ 429, dừng để dành quota cho
          // lượt chạy kế tiếp thay vì đốt hết vào lỗi.
          quotaExhausted = true;
          skipped.quota += 1;
          return;
        }
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

      if (stored) {
        counters.written += 1;
        storedIds.push(stored);
      } else counters.skippedDup += 1;
    } catch (error) {
      // Một bài hỏng không được kéo cả mẻ xuống — xem spec Bước 6.
      counters.failed += 1;
      if (sampleErrors.length < 5) sampleErrors.push(errorMessage(error));
    }
  });

  if (counters.failed > 0 || skipped.quota > 0) {
    console.error(
      `run ${runId} diagnostics`,
      JSON.stringify({ fetchErrors, rewriteReasons, sampleErrors, skipped }),
    );
  }

  // Slug do Postgres phân xử lúc ghi (có thể mang hậu tố chống trùng), nên
  // phải đọc lại từ DB thay vì suy ra từ tiêu đề.
  const writtenPaths =
    storedIds.length === 0
      ? []
      : (
          await deps.db
            .select({ lang: articleContents.lang, slug: articleContents.slug })
            .from(articleContents)
            .where(inArray(articleContents.articleId, storedIds))
        ).map((row) => `/${row.lang}/${row.slug}`);

  await finishRun(deps.db, runId, counters);
  return { runId, counters, skipped, writtenPaths };
}
