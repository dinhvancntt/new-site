/**
 * Đăng một bài tự viết từ file JSON.
 *
 * Cổng chất lượng nằm trong `parseDraft`: sai chuẩn SEO thì không có dòng nào
 * chạm tới database. Đây là chỗ khác biệt so với pipeline tự động — bài tự
 * viết không qua được vòng kiểm duyệt của NewsData nên phải tự kiểm chặt hơn.
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { eq } from 'drizzle-orm';
import { articleContents, createDb } from '@news/db';
import { parseDraft, toStorableArticle } from './editorial.js';
import { submitIndexNow } from './indexnow.js';
import { storeArticle } from './store.js';

export async function main(): Promise<number> {
  const file = process.argv[2];
  if (!file) {
    console.error('Cách dùng: npm run publish -- <đường-dẫn-bản-thảo.json>');
    return 2;
  }

  const raw: unknown = JSON.parse(await readFile(file, 'utf8'));
  const parsed = parseDraft(raw, { now: new Date() });
  if (!parsed.ok) {
    console.error(`Bản thảo chưa đạt, không đăng (${parsed.errors.length} lỗi):`);
    for (const error of parsed.errors) console.error(`  - ${error}`);
    return 1;
  }

  const article = toStorableArticle(parsed.draft);
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL chưa được đặt');

  const db = createDb(url);
  try {
    const articleId = await storeArticle(db, article);
    if (!articleId) {
      console.error(`Đã tồn tại bài với sourceId ${article.sourceId} — không ghi đè`);
      return 1;
    }

    // Slug do Postgres phân xử lúc ghi, phải đọc lại thay vì suy từ tiêu đề.
    const written = await db
      .select({ lang: articleContents.lang, slug: articleContents.slug })
      .from(articleContents)
      .where(eq(articleContents.articleId, articleId));

    const paths = written.map((row) => `/${row.lang}/${row.slug}`);
    console.log(`Đã đăng ${articleId}`);
    for (const path of paths) console.log(`  ${path}`);

    const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'];
    const indexNowKey = process.env['INDEXNOW_KEY'];
    if (siteUrl && indexNowKey) {
      const result = await submitIndexNow(
        paths.map((path) => new URL(path, siteUrl).toString()),
        {
          host: new URL(siteUrl).host,
          key: indexNowKey,
          keyLocation: new URL('/indexnow-key.txt', siteUrl).toString(),
        },
      );
      console.log('indexnow', JSON.stringify(result));
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
