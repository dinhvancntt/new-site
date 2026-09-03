import { pathToFileURL } from 'node:url';
import { createDb } from '@news/db';
import { exitCodeFor } from './exit-code.js';
import { extractArticle } from './extract.js';
import { fetchCategory } from './newsdata.js';
import { runIngest } from './pipeline.js';
import { createRewriteClient, rewriteArticle } from './rewrite.js';

export const CATEGORIES = ['world', 'business', 'technology', 'sports', 'health'] as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} chưa được đặt`);
  return value;
}

/** Điểm vào của worker chạy trên GitHub Actions mỗi 3 giờ. */
export async function main(): Promise<number> {
  const newsdataKey = requireEnv('NEWSDATA_API_KEY');
  requireEnv('BAI_API_KEY');
  const db = createDb(requireEnv('DATABASE_URL'));
  const rewriteDeps = createRewriteClient();

  try {
    const { runId, counters } = await runIngest(
      {
        db,
        fetchCategory: (category) => fetchCategory({ apiKey: newsdataKey, category }),
        extract: (url) => extractArticle(url),
        rewrite: (input) => rewriteArticle(input, rewriteDeps),
      },
      { categories: [...CATEGORIES] },
    );

    console.log(`run ${runId}`, JSON.stringify(counters));
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
