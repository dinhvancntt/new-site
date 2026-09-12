import { pathToFileURL } from 'node:url';
import { createDb } from '@news/db';
import { exitCodeFor } from './exit-code.js';
import { extractArticle } from './extract.js';
import { submitIndexNow } from './indexnow.js';
import { feedCategories, feedDomains } from './feeds.js';
import { fetchFeed } from './newsdata.js';
import { runIngest, defaultConcurrency } from './pipeline.js';
import {
  createRewriteClient,
  ladderBudget,
  resolveModelLadder,
  resolveRewriteConfig,
  rewriteArticle,
} from './rewrite.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} chưa được đặt`);
  return value;
}

/** Điểm vào của worker chạy trên GitHub Actions mỗi 3 giờ. */
export async function main(): Promise<number> {
  const newsdataKey = requireEnv('NEWSDATA_API_KEY');
  const rewriteConfig = resolveRewriteConfig();
  requireEnv(rewriteConfig.provider === 'gemini' ? 'GEMINI_API_KEY' : 'BAI_API_KEY');
  const gemini = rewriteConfig.provider === 'gemini';
  // Trần free tier tính theo request: giãn nhịp và chặn budget ngay từ đây,
  // vì vượt trần thì provider trả 429 và cả mẻ còn lại thành vô ích.
  // Quota free tính riêng từng model, nên xếp thang: hết hạn mức ngày của bậc
  // trên thì client tự tụt xuống bậc dưới, cả run không chết vì một model.
  const ladder = gemini ? resolveModelLadder(process.env) : [];
  const pace = gemini ? ladder : 0;
  const keyCount = rewriteConfig.apiKeys.length;
  const maxRewrites = gemini
    ? ladderBudget(ladder, process.env['REWRITE_MAX_PER_RUN'], keyCount)
    : undefined;
  console.log(
    `rewrite provider: ${rewriteConfig.provider}` +
      (gemini
        ? ` thang=[${ladder.map((rung) => `${rung.model} ${rung.rpm}rpm/${rung.rpd}rpd`).join(' -> ')}]` +
          ` key=${keyCount} budget=${maxRewrites}`
        : ` (${rewriteConfig.model})`),
  );
  const db = createDb(requireEnv('DATABASE_URL'));
  const rewriteDeps = createRewriteClient(rewriteConfig.apiKeys, rewriteConfig.baseUrl, pace);

  try {
    const { runId, counters, skipped, writtenPaths } = await runIngest(
      {
        db,
        fetchCategory: (category) =>
          fetchFeed({ apiKey: newsdataKey, category, domains: feedDomains(category) }),
        extract: (url) => extractArticle(url),
        rewrite: (input) => rewriteArticle(input, rewriteDeps, rewriteConfig.model),
      },
      {
        categories: feedCategories(),
        concurrency: defaultConcurrency(rewriteConfig.provider),
        maxRewrites,
      },
    );

    console.log(`run ${runId}`, JSON.stringify({ ...counters, skipped }));

    // Sau khi đã ghi xong: báo URL mới cho Bing/Yandex. Không tính vào exit
    // code — bài đã nằm trong DB rồi, việc này hỏng chỉ là chậm được index.
    const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'];
    const indexNowKey = process.env['INDEXNOW_KEY'];
    if (siteUrl && indexNowKey && writtenPaths.length > 0) {
      const host = new URL(siteUrl).host;
      const result = await submitIndexNow(
        writtenPaths.map((path) => new URL(path, siteUrl).toString()),
        { host, key: indexNowKey, keyLocation: new URL('/indexnow-key.txt', siteUrl).toString() },
      );
      console.log('indexnow', JSON.stringify(result));
    }

    return exitCodeFor(counters);
  } finally {
    await db.$client.end();
  }
}

// Chỉ tự chạy khi được gọi trực tiếp, để test import module này mà không nổ mạng.
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
