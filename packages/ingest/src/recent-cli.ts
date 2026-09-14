/**
 * Liệt kê bài đã đăng gần đây. Dùng trước khi viết bài mới để không đăng trùng
 * chủ đề — trùng chủ đề là tự cạnh tranh với chính mình trên cùng một truy vấn.
 */
import { pathToFileURL } from 'node:url';
import { desc, eq } from 'drizzle-orm';
import { articleContents, articles, createDb } from '@news/db';

const DEFAULT_LIMIT = 30;

export async function main(): Promise<number> {
  const limit = Number(process.argv[2] ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL chưa được đặt');

  const db = createDb(url);
  try {
    const rows = await db
      .select({
        title: articleContents.title,
        slug: articleContents.slug,
        category: articles.category,
        publishedAt: articles.publishedAt,
        sourceName: articles.sourceName,
      })
      .from(articleContents)
      .innerJoin(articles, eq(articleContents.articleId, articles.id))
      .where(eq(articleContents.lang, 'en'))
      .orderBy(desc(articles.publishedAt))
      .limit(limit);

    console.log(`${rows.length} bài gần nhất:\n`);
    for (const row of rows) {
      const day = row.publishedAt.toISOString().slice(0, 10);
      console.log(`${day} | ${row.category.padEnd(11)} | ${row.title}`);
      console.log(`             /en/${row.slug}  (${row.sourceName})`);
    }
    return 0;
  } finally {
    await db.$client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => {
      process.exit(code);
    },
    (error: unknown) => {
      console.error(error);
      process.exit(1);
    },
  );
}
