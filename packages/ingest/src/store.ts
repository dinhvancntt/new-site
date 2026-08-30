import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { articles, articleContents, ingestRuns, removeDiacritics, slugify, type Db } from '@news/db';
import { titleHash } from './dedupe.js';

export type LangContent = { title: string; summary: string; body: string };

export type StorableArticle = {
  sourceId: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string | null;
  category: string;
  publishedAt: Date;
  model: string;
  contents: { vi: LangContent; en: LangContent };
};

export type RunCounters = {
  fetched: number;
  skippedDup: number;
  skippedExtract: number;
  written: number;
  failed: number;
};

const LANGS = ['vi', 'en'] as const;

function searchTextOf(content: LangContent): string {
  return removeDiacritics(`${content.title} ${content.summary}`).replace(/\s+/g, ' ').trim();
}

/** Hậu tố ổn định theo bài, chỉ dùng khi slug gốc đã bị chiếm. */
function slugSuffix(sourceId: string): string {
  return createHash('sha256').update(sourceId).digest('hex').slice(0, 6);
}

/**
 * Ghi một bài cùng nội dung hai ngôn ngữ trong đúng một transaction.
 * Trả về `null` nếu `source_id` đã tồn tại — khi đó không có dòng nào được ghi.
 */
export async function storeArticle(db: Db, input: StorableArticle): Promise<string | null> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(articles)
      .values({
        sourceId: input.sourceId,
        titleHash: titleHash(input.title),
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl,
        imageUrl: input.imageUrl,
        category: input.category,
        publishedAt: input.publishedAt,
        model: input.model,
      })
      .onConflictDoNothing()
      .returning({ id: articles.id });

    const articleId = inserted[0]?.id;
    if (!articleId) return null;

    for (const lang of LANGS) {
      const content = input.contents[lang];
      const row = {
        articleId,
        lang,
        title: content.title,
        summary: content.summary,
        body: content.body,
        searchText: searchTextOf(content),
      };
      const base = slugify(content.title);

      // Để Postgres phân xử slug thay vì tự kiểm tra trước: kiểm tra trước rồi
      // insert là một race, hai bài cùng slug chạy song song sẽ làm vỡ transaction.
      const claimed = await tx
        .insert(articleContents)
        .values({ ...row, slug: base })
        .onConflictDoNothing({ target: [articleContents.lang, articleContents.slug] })
        .returning({ slug: articleContents.slug });

      if (claimed.length === 0) {
        await tx.insert(articleContents).values({ ...row, slug: `${base}-${slugSuffix(input.sourceId)}` });
      }
    }

    return articleId;
  });
}

export async function startRun(db: Db): Promise<string> {
  const [run] = await db.insert(ingestRuns).values({}).returning({ id: ingestRuns.id });
  return run!.id;
}

export async function finishRun(db: Db, runId: string, counters: RunCounters): Promise<void> {
  await db
    .update(ingestRuns)
    .set({ ...counters, finishedAt: new Date() })
    .where(eq(ingestRuns.id, runId));
}
