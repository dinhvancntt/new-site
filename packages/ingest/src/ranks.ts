/**
 * Tín hiệu xếp hạng để chọn chủ đề, thay cho việc đoán chủ đề nào đáng viết.
 *
 * Hai nguồn, dùng được độc lập:
 * - Google Suggest: không cần khoá, phản ánh truy vấn người ta thực sự gõ.
 * - Search Console: cần khoá, cho biết trang đang đứng hạng mấy ở truy vấn nào.
 *
 * Truy vấn đáng viết nhất là truy vấn đã có thứ hạng nhưng chưa lên trang 1:
 * Google đã công nhận trang có liên quan, chỉ thiếu một bài đủ tốt. Viết cho
 * truy vấn hạng 60 là viết từ đầu; viết cho truy vấn hạng 2 là phí công.
 */

export type GscRow = {
  query: string;
  impressions: number;
  clicks: number;
  position: number;
};

export type RankedQuery = GscRow & { score: number };

export type Candidate = {
  query: string;
  category: string;
  signal: 'gsc' | 'suggest';
  score: number;
  position?: number;
  impressions?: number;
};

/** Dưới hạng này thì đã ở trang 1, giành thêm được rất ít. */
const MIN_POSITION = 8;
/** Trên hạng này thì một bài viết đơn lẻ khó kéo về trang 1. */
const MAX_POSITION = 20;
/** Dưới ngưỡng hiển thị này thì truy vấn không đủ nhu cầu để đáng một bài. */
const MIN_IMPRESSIONS = 50;

/**
 * Seed để hỏi autocomplete. Bám vào ngách thật (giải đấu, thiết bị, nhân vật)
 * chứ không dùng tên chuyên mục trần — "motorsport" trả về gợi ý chung chung,
 * còn "f1 sprint" trả về đúng thứ độc giả của ngách này đang gõ.
 */
const SEEDS: Record<string, readonly string[]> = {
  motorsport: ['f1', 'formula 1 2026', 'motogp', 'wrc rally', 'le mans'],
  cycling: ['tour de france', 'giro d italia', 'cycling gravel bike', 'uci world tour'],
  equestrian: ['show jumping', 'dressage', 'eventing horse', 'equestrian olympics'],
};

export function seedsFor(category: string): string[] {
  const seeds = SEEDS[category];
  if (!seeds) throw new Error(`Chưa có seed truy vấn cho chuyên mục "${category}"`);
  return [...seeds];
}

const SUGGEST_ENDPOINT = 'https://suggestqueries.google.com/complete/search';

function normalize(text: string): string {
  return text.trim().toLowerCase().split(/\s+/).join(' ');
}

export function suggestUrl(seed: string, hl = 'en'): string {
  const url = new URL(SUGGEST_ENDPOINT);
  // client=firefox trả JSON trần, không bọc callback như client mặc định.
  url.searchParams.set('client', 'firefox');
  url.searchParams.set('hl', hl);
  // Không ép thì endpoint trả Latin-1, tên như "Le Mans Université" về dạng hỏng.
  url.searchParams.set('ie', 'utf-8');
  url.searchParams.set('oe', 'utf-8');
  url.searchParams.set('q', seed);
  return url.toString();
}

/** Payload dạng [seed, [gợi ý...], ...]; mọi hình dạng khác coi như rỗng. */
export function parseSuggest(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  const suggestions = payload[1];
  if (!Array.isArray(suggestions)) return [];
  return suggestions.filter((item): item is string => typeof item === 'string');
}

/**
 * Bỏ head term khỏi danh sách gợi ý. Truy vấn trùng hệt seed ("f1") có lượng
 * tìm khổng lồ nhưng trang 1 đã thuộc về các site lớn — nhắm vào đó là phí
 * bài. Đuôi dài của chính seed đó mới là chỗ một site ngách còn cửa.
 */
export function longTail(seed: string, suggestions: readonly string[]): string[] {
  const head = normalize(seed);
  return suggestions.filter((suggestion) => {
    const candidate = normalize(suggestion);
    return candidate !== '' && candidate !== head;
  });
}

/** Hạng càng sát trang 1 thì cùng một lượt hiển thị càng dễ đổi thành click. */
function positionWeight(position: number): number {
  return (MAX_POSITION + 1 - position) / MAX_POSITION;
}

export function strikingDistance(rows: readonly GscRow[]): RankedQuery[] {
  return rows
    .filter(
      (row) =>
        row.position >= MIN_POSITION &&
        row.position <= MAX_POSITION &&
        row.impressions >= MIN_IMPRESSIONS,
    )
    .map((row) => ({ ...row, score: row.impressions * positionWeight(row.position) }))
    .sort((a, b) => b.score - a.score);
}

export type RankInput = {
  gsc: readonly GscRow[];
  suggest: readonly string[];
  category: string;
};

/**
 * Gộp hai nguồn tín hiệu. Truy vấn có dữ liệu GSC luôn đứng trước gợi ý suy
 * đoán — số liệu thật của chính trang này nặng hơn phỏng đoán từ autocomplete.
 */
export function rankCandidates({ gsc, suggest, category }: RankInput): Candidate[] {
  const ranked = strikingDistance(gsc);
  const seen = new Set(ranked.map((row) => row.query.toLowerCase()));

  const candidates: Candidate[] = ranked.map((row) => ({
    query: row.query,
    category,
    signal: 'gsc',
    score: row.score,
    position: row.position,
    impressions: row.impressions,
  }));

  for (const query of suggest) {
    const key = query.trim().toLowerCase();
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    candidates.push({ query, category, signal: 'suggest', score: 0 });
  }

  return candidates;
}
