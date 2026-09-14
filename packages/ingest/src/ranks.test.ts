import { describe, expect, test } from 'vitest';
import {
  parseSuggest,
  longTail,
  rankCandidates,
  seedsFor,
  strikingDistance,
  suggestUrl,
  type GscRow,
} from './ranks.js';

describe('suggestUrl', () => {
  test('mã hoá seed và ghim ngôn ngữ để kết quả lặp lại được', () => {
    const url = new URL(suggestUrl('f1 sprint format'));
    expect(url.searchParams.get('q')).toBe('f1 sprint format');
    expect(url.searchParams.get('hl')).toBe('en');
  });

  test('ép UTF-8 để dấu trong tên riêng không về dạng hỏng', () => {
    const url = new URL(suggestUrl('le mans'));
    expect(url.searchParams.get('oe')).toBe('utf-8');
    expect(url.searchParams.get('ie')).toBe('utf-8');
  });
});

describe('parseSuggest', () => {
  test('lấy đúng mảng gợi ý thứ hai trong payload', () => {
    const payload = ['f1 sprint', ['f1 sprint format', 'f1 sprint points'], [], {}];
    expect(parseSuggest(payload)).toEqual(['f1 sprint format', 'f1 sprint points']);
  });

  test('trả mảng rỗng khi payload không đúng hình dạng', () => {
    expect(parseSuggest({ unexpected: true })).toEqual([]);
    expect(parseSuggest(['chỉ có seed'])).toEqual([]);
  });

  test('bỏ phần tử không phải chuỗi thay vì để lọt vào kết quả', () => {
    expect(parseSuggest(['seed', ['hợp lệ', 42, null]])).toEqual(['hợp lệ']);
  });
});

function row(overrides: Partial<GscRow> = {}): GscRow {
  return { query: 'f1 sprint format', impressions: 500, clicks: 2, position: 12, ...overrides };
}

describe('strikingDistance', () => {
  test('giữ lại truy vấn nằm trong tầm với của trang 1', () => {
    expect(strikingDistance([row({ position: 12 })])).toHaveLength(1);
  });

  test('loại truy vấn đã đứng top đầu vì không còn gì để giành', () => {
    expect(strikingDistance([row({ position: 2 })])).toEqual([]);
  });

  test('loại truy vấn xếp quá xa để một bài viết kéo về trang 1', () => {
    expect(strikingDistance([row({ position: 60 })])).toEqual([]);
  });

  test('loại truy vấn không đủ lượt hiển thị để đáng viết', () => {
    expect(strikingDistance([row({ impressions: 3 })])).toEqual([]);
  });

  test('xếp cơ hội lớn lên trước', () => {
    const ranked = strikingDistance([
      row({ query: 'ít hiển thị', impressions: 120, position: 11 }),
      row({ query: 'nhiều hiển thị', impressions: 900, position: 11 }),
    ]);
    expect(ranked.map((item) => item.query)).toEqual(['nhiều hiển thị', 'ít hiển thị']);
  });

  test('ưu tiên thứ hạng sát trang 1 khi lượt hiển thị ngang nhau', () => {
    const ranked = strikingDistance([
      row({ query: 'xa hơn', impressions: 500, position: 19 }),
      row({ query: 'sát hơn', impressions: 500, position: 9 }),
    ]);
    expect(ranked[0]?.query).toBe('sát hơn');
  });
});

describe('rankCandidates', () => {
  test('xếp truy vấn có dữ liệu GSC lên trên gợi ý suy đoán', () => {
    const candidates = rankCandidates({
      gsc: [row({ query: 'từ gsc', impressions: 300, position: 14 })],
      suggest: ['từ suggest'],
      category: 'motorsport',
    });
    expect(candidates[0]).toMatchObject({ query: 'từ gsc', signal: 'gsc' });
    expect(candidates.at(-1)).toMatchObject({ query: 'từ suggest', signal: 'suggest' });
  });

  test('không lặp lại truy vấn đã có tín hiệu GSC', () => {
    const candidates = rankCandidates({
      gsc: [row({ query: 'trùng nhau' })],
      suggest: ['trùng nhau', 'khác'],
      category: 'motorsport',
    });
    expect(candidates.filter((item) => item.query === 'trùng nhau')).toHaveLength(1);
  });

  test('gắn chuyên mục vào mọi ứng viên để chọn ngách không bị lẫn', () => {
    const candidates = rankCandidates({ gsc: [], suggest: ['a'], category: 'cycling' });
    expect(candidates.every((item) => item.category === 'cycling')).toBe(true);
  });
});

describe('seedsFor', () => {
  test('mỗi ngách có seed riêng, không dùng chung từ khoá', () => {
    expect(seedsFor('motorsport')).not.toEqual(seedsFor('cycling'));
  });

  test('seed bám vào ngách chứ không phải tên chuyên mục trần', () => {
    expect(seedsFor('motorsport').length).toBeGreaterThan(1);
    expect(seedsFor('motorsport')).not.toEqual(['motorsport']);
  });

  test('báo lỗi rõ khi hỏi chuyên mục không thu thập', () => {
    expect(() => seedsFor('football')).toThrow(/football/);
  });
});

describe('longTail', () => {
  test('bỏ gợi ý trùng hệt seed vì head term quá rộng để nhắm', () => {
    expect(longTail('f1', ['f1', 'f1 sprint format'])).toEqual(['f1 sprint format']);
  });

  test('bỏ qua khác biệt hoa thường và khoảng trắng thừa khi so với seed', () => {
    expect(longTail('f1', ['  F1  '])).toEqual([]);
  });

  test('giữ gợi ý dài hơn seed dù không bắt đầu bằng seed', () => {
    expect(longTail('f1', ['best f1 races 2026'])).toEqual(['best f1 races 2026']);
  });

  test('bỏ gợi ý rỗng thay vì để lọt chuỗi trắng', () => {
    expect(longTail('f1', ['', '   '])).toEqual([]);
  });
});
