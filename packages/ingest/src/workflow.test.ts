import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { resolveRewriteConfig } from './rewrite';

const WORKFLOW = new URL('../../../.github/workflows/ingest.yml', import.meta.url);

// Lấy danh sách biến môi trường mà step chạy ingest được truyền vào.
// Không dùng thư viện YAML: chỉ cần khối env ngay dưới `run: npm run ingest`.
function ingestStepEnv(): string[] {
  const text = readFileSync(WORKFLOW, 'utf8');
  const start = text.indexOf('npm run ingest');
  if (start === -1) throw new Error('workflow không có step `npm run ingest`');
  const after = text.slice(start);
  const envAt = after.indexOf('env:');
  if (envAt === -1) throw new Error('step ingest không có khối env');
  return [...after.slice(envAt).matchAll(/^\s+([A-Z][A-Z0-9_]*):/gm)].flatMap((m) =>
    m[1] ? [m[1]] : [],
  );
}

describe('workflow ingest', () => {
  test('truyền secret dữ liệu cho step ingest', () => {
    const keys = ingestStepEnv();
    expect(keys).toContain('NEWSDATA_API_KEY');
    expect(keys).toContain('DATABASE_URL');
  });

  test('truyền đủ env để chọn được provider viết lại', () => {
    const keys = ingestStepEnv();
    // resolveRewriteConfig đọc REWRITE_PROVIDER + key của provider; thiếu key
    // Gemini thì runner luôn rơi về bai dù secret Gemini đã có trên repo.
    expect(keys).toContain('REWRITE_PROVIDER');
    expect(keys).toContain('GEMINI_API_KEY');
    expect(keys).toContain('BAI_API_KEY');
    // Đổi thang model là đổi trần quota, phải làm được bằng biến repo chứ không
    // phải sửa code rồi deploy lại.
    expect(keys).toContain('GEMINI_MODELS');
    expect(keys).toContain('REWRITE_MAX_PER_RUN');
  });

  test('env được truyền đủ cho provider mà code thực sự chọn', () => {
    const keys = ingestStepEnv();
    const env = Object.fromEntries(keys.map((k) => [k, 'x']));
    const cfg = resolveRewriteConfig(env);
    expect(cfg.apiKey).toBeTruthy();
  });
});
