import { sql } from 'drizzle-orm';
import {
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** tsvector chưa có sẵn trong drizzle pg-core. */
const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

export const articles = pgTable(
  'articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: text('source_id').notNull().unique(),
    titleHash: text('title_hash').notNull().unique(),
    sourceName: text('source_name').notNull(),
    sourceUrl: text('source_url').notNull(),
    imageUrl: text('image_url'),
    category: text('category').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
    model: text('model').notNull(),
  },
  (table) => [
    index('articles_published_at_idx').on(table.publishedAt.desc()),
    index('articles_category_published_at_idx').on(table.category, table.publishedAt.desc()),
  ],
);

export const articleContents = pgTable(
  'article_contents',
  {
    articleId: uuid('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    lang: text('lang').notNull(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    body: text('body').notNull(),
    searchText: text('search_text').notNull(),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`to_tsvector('simple', search_text)`,
    ),
  },
  (table) => [
    uniqueIndex('article_contents_article_lang_idx').on(table.articleId, table.lang),
    uniqueIndex('article_contents_lang_slug_idx').on(table.lang, table.slug),
    index('article_contents_search_idx').using('gin', table.searchVector),
  ],
);

export const ingestRuns = pgTable('ingest_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  fetched: integer('fetched').notNull().default(0),
  skippedDup: integer('skipped_dup').notNull().default(0),
  skippedExtract: integer('skipped_extract').notNull().default(0),
  written: integer('written').notNull().default(0),
  failed: integer('failed').notNull().default(0),
  error: text('error'),
});

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type ArticleContent = typeof articleContents.$inferSelect;
export type NewArticleContent = typeof articleContents.$inferInsert;
export type IngestRun = typeof ingestRuns.$inferSelect;
