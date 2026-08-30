import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { articles, articleContents, ingestRuns, type Db } from '@news/db';
import { titleHash } from './dedupe.js';
import { removeDiacritics, slugify } from './slug.js';

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
      const base = slugify(content.title);
      const taken = await tx
        .select({ slug: articleContents.slug })
        .from(articleContents)
        .where(and(eq(articleContents.lang, lang), eq(articleContents.slug, base)))
        .limit(1);

      await tx.insert(articleContents).values({
        articleId,
        lang,
        slug: taken.length > 0 ? `${base}-${slugSuffix(input.sourceId)}` : base,
        title: content.title,
        summary: content.summary,
        body: content.body,
        searchText: searchTextOf(content),
      });
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
