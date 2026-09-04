import { and, desc, eq, sql } from 'drizzle-orm';
import { articleContents, articles, removeDiacritics, type Db } from '@news/db';

export type Lang = 'vi' | 'en';

export type ArticleCard = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  sourceName: string;
  imageUrl: string | null;
  publishedAt: Date;
};

export type ArticleDetail = ArticleCard & {
  articleId: string;
  body: string;
  sourceUrl: string;
};

/** Dòng sitemap: đủ khóa để ghép cặp vi–en (hreflang) và kèm ảnh (image sitemap). */
export type SitemapEntry = {
  articleId: string;
  slug: string;
  title: string;
  publishedAt: Date;
  imageUrl: string | null;
};

export type ListOptions = { limit: number; offset?: number };

const cardColumns = {
  slug: articleContents.slug,
  title: articleContents.title,
  summary: articleContents.summary,
  category: articles.category,
  sourceName: articles.sourceName,
  imageUrl: articles.imageUrl,
  publishedAt: articles.publishedAt,
};

function listQuery(db: Db, lang: Lang, { limit, offset = 0 }: ListOptions) {
  return db
    .select(cardColumns)
    .from(articleContents)
    .innerJoin(articles, eq(articles.id, articleContents.articleId))
    .orderBy(desc(articles.publishedAt), desc(articleContents.slug))
    .limit(limit)
    .offset(offset)
    .$dynamic();
}

export function listLatest(db: Db, lang: Lang, options: ListOptions): Promise<ArticleCard[]> {
  return listQuery(db, lang, options).where(eq(articleContents.lang, lang));
}

export function listByCategory(
  db: Db,
  lang: Lang,
  category: string,
  options: ListOptions,
): Promise<ArticleCard[]> {
  return listQuery(db, lang, options).where(
    and(eq(articleContents.lang, lang), eq(articles.category, category)),
  );
}

/** Liệt kê bài cho sitemap: mới nhất trước, kèm articleId để ghép cặp ngôn ngữ. */
export function listSitemapEntries(db: Db, lang: Lang, options: ListOptions): Promise<SitemapEntry[]> {
  const { limit, offset = 0 } = options;
  return db
    .select({
      articleId: articles.id,
      slug: articleContents.slug,
      title: articleContents.title,
      publishedAt: articles.publishedAt,
      imageUrl: articles.imageUrl,
    })
    .from(articleContents)
    .innerJoin(articles, eq(articles.id, articleContents.articleId))
    .where(eq(articleContents.lang, lang))
    .orderBy(desc(articles.publishedAt), desc(articleContents.slug))
    .limit(limit)
    .offset(offset)
    .$dynamic();
}

export async function getArticle(db: Db, lang: Lang, slug: string): Promise<ArticleDetail | null> {
  const [row] = await db
    .select({
      ...cardColumns,
      articleId: articles.id,
      body: articleContents.body,
      sourceUrl: articles.sourceUrl,
    })
    .from(articleContents)
    .innerJoin(articles, eq(articles.id, articleContents.articleId))
    .where(and(eq(articleContents.lang, lang), eq(articleContents.slug, slug)))
    .limit(1);

  return row ?? null;
}

/** Nút chuyển ngôn ngữ: cùng một bài, slug của ngôn ngữ kia. */
export async function siblingSlug(db: Db, articleId: string, lang: Lang): Promise<string | null> {
  const [row] = await db
    .select({ slug: articleContents.slug })
    .from(articleContents)
    .where(and(eq(articleContents.articleId, articleId), eq(articleContents.lang, lang)))
    .limit(1);

  return row?.slug ?? null;
}

export function searchArticles(
  db: Db,
  lang: Lang,
  query: string,
  { limit, offset = 0 }: ListOptions,
): Promise<ArticleCard[]> {
  // search_vector dựng từ search_text đã bỏ dấu bằng cấu hình 'simple', nên câu
  // hỏi phải đi qua đúng phép chuẩn hóa đó thì gõ không dấu mới ra kết quả.
  const normalized = removeDiacritics(query).trim();
  if (normalized === '') return Promise.resolve([]);

  const tsquery = sql`plainto_tsquery('simple', ${normalized})`;

  return db
    .select(cardColumns)
    .from(articleContents)
    .innerJoin(articles, eq(articles.id, articleContents.articleId))
    .where(and(eq(articleContents.lang, lang), sql`${articleContents.searchVector} @@ ${tsquery}`))
    .orderBy(desc(sql`ts_rank(${articleContents.searchVector}, ${tsquery})`), desc(articles.publishedAt))
    .limit(limit)
    .offset(offset);
}
