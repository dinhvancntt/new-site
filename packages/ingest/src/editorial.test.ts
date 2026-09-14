import { describe, expect, test } from 'vitest';
import { parseDraft, toStorableArticle, validateDraft, type EditorialDraft } from './editorial.js';

const KEYWORD = 'f1 sprint format';

/** Chuỗi có độ dài chính xác, vẫn giữ được phần chữ nghĩa ở đầu. */
function ofLength(base: string, len: number): string {
  if (base.length >= len) return base.slice(0, len);
  return `${base} ${'chi tiet '.repeat(len).slice(0, len - base.length - 1)}`;
}

function body(wordCount: number, keyword: string, occurrences = 1): string {
  const words = Array.from({ length: wordCount }, (_, i) => `tu${i}`);
  for (let n = 0; n < occurrences; n++) words[n * 20 + 5] = keyword;
  const perPara = Math.ceil(words.length / 6);
  const paras: string[] = [];
  for (let i = 0; i < words.length; i += perPara) paras.push(words.slice(i, i + perPara).join(' '));
  return paras.join('\n\n');
}

function draft(overrides: Partial<EditorialDraft> = {}): EditorialDraft {
  return {
    category: 'motorsport',
    keyword: KEYWORD,
    publishedAt: new Date('2026-09-14T02:00:00Z'),
    model: 'claude-opus-5',
    primarySource: { name: 'Autosport', url: 'https://www.autosport.com/f1/news/abc' },
    sources: ['https://www.autosport.com/f1/news/abc', 'https://www.motorsport.com/f1/news/xyz'],
    imageUrl: null,
    tags: ['f1', 'sprint', 'formula 1'],
    en: {
      title: ofLength(`F1 Sprint Format Explained For 2026`, 55),
      summary: ofLength('The sprint weekend changes again next season.', 145),
      body: body(700, KEYWORD, 4),
    },
    vi: {
      title: ofLength('Thể thức sprint F1 đổi ra sao từ mùa 2026', 55),
      summary: ofLength('Cuối tuần sprint thay đổi lần nữa từ mùa tới.', 145),
      body: body(700, 'sprint', 4),
    },
    ...overrides,
  };
}

function errorsOf(input: EditorialDraft): string[] {
  const result = validateDraft(input);
  return result.ok ? [] : result.errors;
}

describe('validateDraft', () => {
  test('chấp nhận bản thảo đạt chuẩn', () => {
    expect(validateDraft(draft())).toEqual({ ok: true });
  });

  test('từ chối chuyên mục ngoài danh sách ngách', () => {
    expect(errorsOf(draft({ category: 'football' }))).toContainEqual(
      expect.stringContaining('category'),
    );
  });

  test('từ chối tiêu đề dài quá ngưỡng bị Google cắt', () => {
    const en = { ...draft().en, title: ofLength('F1 Sprint Format Explained', 80) };
    expect(errorsOf(draft({ en }))).toContainEqual(expect.stringContaining('title'));
  });

  test('từ chối meta description quá ngắn', () => {
    const en = { ...draft().en, summary: 'Quá ngắn.' };
    expect(errorsOf(draft({ en }))).toContainEqual(expect.stringContaining('summary'));
  });

  test('từ chối thân bài mỏng dưới ngưỡng từ tối thiểu', () => {
    const en = { ...draft().en, body: body(200, KEYWORD, 1) };
    expect(errorsOf(draft({ en }))).toContainEqual(expect.stringContaining('body'));
  });

  test('từ chối khi keyword chính vắng mặt trong tiêu đề tiếng Anh', () => {
    const en = { ...draft().en, title: ofLength('Something Entirely Unrelated Here', 55) };
    expect(errorsOf(draft({ en }))).toContainEqual(expect.stringContaining('keyword'));
  });

  test('từ chối nhồi keyword vượt mật độ cho phép', () => {
    const en = { ...draft().en, body: body(700, KEYWORD, 30) };
    expect(errorsOf(draft({ en }))).toContainEqual(expect.stringContaining('keyword'));
  });

  test('từ chối bài chỉ dựa trên một nguồn', () => {
    expect(errorsOf(draft({ sources: ['https://www.autosport.com/f1/news/abc'] }))).toContainEqual(
      expect.stringContaining('sources'),
    );
  });

  test('từ chối tags viết hoa', () => {
    expect(errorsOf(draft({ tags: ['F1', 'sprint', 'formula 1'] }))).toContainEqual(
      expect.stringContaining('tags'),
    );
  });

  test('từ chối bản thảo còn chỗ trống chưa điền', () => {
    const vi = { ...draft().vi, body: `${body(700, 'sprint', 4)}\n\nTODO: bổ sung số liệu` };
    expect(errorsOf(draft({ vi }))).toContainEqual(expect.stringContaining('placeholder'));
  });

  test('gom đủ mọi lỗi trong một lần thay vì dừng ở lỗi đầu', () => {
    const broken = draft({ category: 'football', sources: [], tags: [] });
    expect(errorsOf(broken).length).toBeGreaterThanOrEqual(3);
  });
});

describe('toStorableArticle', () => {
  const titled = () => draft({ en: { ...draft().en, title: 'F1 Sprint Format Explained For The 2026 Season' } });

  test('sinh sourceId ổn định, không đụng không gian id của NewsData', () => {
    const article = toStorableArticle(titled());
    expect(article.sourceId).toBe(
      'editorial:2026-09-14:f1-sprint-format-explained-for-the-2026-season',
    );
    expect(toStorableArticle(titled()).sourceId).toBe(article.sourceId);
  });

  test('lấy nguồn chính làm sourceName và sourceUrl', () => {
    const article = toStorableArticle(draft());
    expect(article.sourceName).toBe('Autosport');
    expect(article.sourceUrl).toBe('https://www.autosport.com/f1/news/abc');
  });

  test('chuyển nguyên vẹn nội dung hai ngôn ngữ', () => {
    const input = draft();
    const article = toStorableArticle(input);
    expect(article.contents.en.title).toBe(input.en.title);
    expect(article.contents.vi.body).toBe(input.vi.body);
  });
});

describe('parseDraft', () => {
  const now = new Date('2026-09-14T02:00:00Z');
  const asJson = (input: EditorialDraft = draft()): unknown => JSON.parse(JSON.stringify(input));

  function parsed(raw: unknown) {
    const result = parseDraft(raw, { now });
    if (!result.ok) throw new Error(`không parse được: ${result.errors.join('; ')}`);
    return result.draft;
  }

  function failures(raw: unknown): string[] {
    const result = parseDraft(raw, { now });
    return result.ok ? [] : result.errors;
  }

  test('dựng lại Date từ chuỗi ISO trong JSON', () => {
    expect(parsed(asJson()).publishedAt).toEqual(new Date('2026-09-14T02:00:00Z'));
  });

  test('lấy thời điểm chạy khi bản thảo không ghi ngày đăng', () => {
    const raw = asJson() as Record<string, unknown>;
    delete raw['publishedAt'];
    expect(parsed(raw).publishedAt).toEqual(now);
  });

  test('từ chối ngày đăng không đọc được thay vì lặng lẽ lấy hiện tại', () => {
    const raw = { ...(asJson() as object), publishedAt: 'hôm qua' };
    expect(failures(raw)).toContainEqual(expect.stringContaining('publishedAt'));
  });

  test('báo lỗi khi thiếu hẳn một khối ngôn ngữ', () => {
    const raw = asJson() as Record<string, unknown>;
    delete raw['vi'];
    expect(failures(raw)).toContainEqual(expect.stringContaining('vi'));
  });

  test('mặc định imageUrl là null khi bản thảo không có ảnh', () => {
    const raw = asJson() as Record<string, unknown>;
    delete raw['imageUrl'];
    expect(parsed(raw).imageUrl).toBeNull();
  });

  test('chuyển tiếp lỗi SEO chứ không chỉ kiểm tra hình dạng', () => {
    const broken = draft({ tags: ['F1', 'sprint', 'formula 1'] });
    expect(failures(asJson(broken))).toContainEqual(expect.stringContaining('tags'));
  });

  test('từ chối JSON không phải đối tượng', () => {
    expect(failures('[]')).not.toEqual([]);
    expect(failures(null)).not.toEqual([]);
  });
});
