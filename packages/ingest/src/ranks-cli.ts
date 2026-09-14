/**
 * In ra chủ đề đáng viết, xếp theo tín hiệu xếp hạng thật.
 *
 * Chạy được ngay không cần khoá: Google Suggest cho biết người ta đang gõ gì.
 * Có khoá GSC thì thêm phần giá trị nhất — truy vấn trang đã đứng hạng 8-20,
 * tức Google đã công nhận liên quan, chỉ thiếu một bài đủ tốt để lên trang 1.
 */
import { pathToFileURL } from 'node:url';
import { feedCategories } from './feeds.js';
import { fetchGscRows, resolveGscConfig } from './gsc.js';
import {
  longTail,
  parseSuggest,
  rankCandidates,
  seedsFor,
  strikingDistance,
  suggestUrl,
  type Candidate,
  type GscRow,
} from './ranks.js';

/** Suggest không có quota công bố; giãn nhịp để không bị chặn tạm thời. */
const SUGGEST_DELAY_MS = 300;
/** Chia đều slot cho mọi seed, tránh một giải đấu nuốt hết bảng gợi ý. */
const PER_SEED = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Một seed hỏng không được làm hỏng cả bảng gợi ý. */
async function suggestFor(seed: string): Promise<string[]> {
  try {
    const response = await fetch(suggestUrl(seed));
    if (!response.ok) return [];
    return parseSuggest(JSON.parse(await response.text()));
  } catch (error) {
    console.error(`suggest "${seed}" lỗi: ${messageOf(error)}`);
    return [];
  }
}

async function loadGscRows(): Promise<GscRow[]> {
  const config = resolveGscConfig(process.env);
  if (!config) {
    console.log(
      'gsc: chưa cấu hình (GSC_SITE_URL, GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY) — chỉ dùng Google Suggest',
    );
    return [];
  }

  try {
    const rows = await fetchGscRows(config, { days: 28 });
    console.log(`gsc: ${rows.length} truy vấn trong 28 ngày qua`);
    return rows;
  } catch (error) {
    // Thiếu dữ liệu xếp hạng làm kết quả nghèo đi, không làm hỏng cả lệnh.
    console.error(`gsc bỏ qua: ${messageOf(error)}`);
    return [];
  }
}

export async function main(): Promise<number> {
  const gscRows = await loadGscRows();

  const opportunities = strikingDistance(gscRows);
  if (opportunities.length > 0) {
    console.log('\n== Trong tầm với trang 1 (hạng 8-20, ưu tiên viết trước) ==');
    for (const row of opportunities.slice(0, 20)) {
      console.log(
        `  hạng ${row.position.toFixed(1).padStart(5)} | ${String(row.impressions).padStart(6)} hiển thị | ${row.clicks} click | ${row.query}`,
      );
    }
  }

  const byCategory: Record<string, Candidate[]> = {};
  for (const category of feedCategories()) {
    const suggestions: string[] = [];
    for (const seed of seedsFor(category)) {
      suggestions.push(...longTail(seed, await suggestFor(seed)).slice(0, PER_SEED));
      await sleep(SUGGEST_DELAY_MS);
    }

    const candidates = rankCandidates({ gsc: [], suggest: suggestions, category });
    byCategory[category] = candidates;

    console.log(`\n== ${category}: người đọc đang gõ gì ==`);
    for (const candidate of candidates) console.log(`  ${candidate.query}`);
  }

  console.log(
    `\n${JSON.stringify({ strikingDistance: opportunities.slice(0, 20), suggest: byCategory })}`,
  );
  return 0;
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
