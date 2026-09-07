import { pathToFileURL } from 'node:url';
import { createDb } from '@news/db';
import { exitCodeFor } from './exit-code.js';
import { extractArticle } from './extract.js';
import { fetchCategory } from './newsdata.js';
import { runIngest, defaultConcurrency } from './pipeline.js';
import {
  createRewriteClient,
  ladderBudget,
  resolveModelLadder,
  resolveRewriteConfig,
  rewriteArticle,
} from './rewrite.js';

export const CATEGORIES = ['world', 'business', 'technology', 'sports', 'health'] as const;

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
  const maxRewrites = gemini
    ? ladderBudget(ladder, process.env['REWRITE_MAX_PER_RUN'])
    : undefined;
  console.log(
    `rewrite provider: ${rewriteConfig.provider}` +
      (gemini
        ? ` thang=[${ladder.map((rung) => `${rung.model} ${rung.rpm}rpm/${rung.rpd}rpd`).join(' -> ')}] budget=${maxRewrites}`
        : ` (${rewriteConfig.model})`),
  );
  const db = createDb(requireEnv('DATABASE_URL'));
  const rewriteDeps = createRewriteClient(rewriteConfig.apiKey, rewriteConfig.baseUrl, pace);

  try {
    const { runId, counters, skipped } = await runIngest(
      {
        db,
        fetchCategory: (category) => fetchCategory({ apiKey: newsdataKey, category }),
        extract: (url) => extractArticle(url),
        rewrite: (input) => rewriteArticle(input, rewriteDeps, rewriteConfig.model),
      },
      {
        categories: [...CATEGORIES],
        concurrency: defaultConcurrency(rewriteConfig.provider),
        maxRewrites,
      },
    );

    console.log(`run ${runId}`, JSON.stringify({ ...counters, skipped }));
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
