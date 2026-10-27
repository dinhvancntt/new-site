import { describe, expect, test } from 'vitest';
import { LANGS, RETIRED_LANGS, isRetiredLang,
  switchableLang, parseLang, retiredArticleTarget } from './lang';

describe('ngôn ngữ đang xuất bản', () => {
  test('chỉ còn tiếng Anh', () => {
    expect(LANGS).toEqual(['en']);
  });

  test('tiếng Việt nằm trong nhóm đã ngừng', () => {
    expect(RETIRED_LANGS).toEqual(['vi']);
  });
});

describe('parseLang', () => {
  test('vẫn nhận "vi" để route /vi còn chạy được mà 308 sang /en', () => {
    // Ngừng xuất bản không đồng nghĩa với 404: 718 URL /vi đang có thứ hạng,
    // phải định tuyến được thì mới chuyển hướng và giữ lại liên kết trỏ về.
    expect(parseLang('vi')).toBe('vi');
    expect(parseLang('en')).toBe('en');
  });

  test('từ chối giá trị khác để route 404', () => {
    expect(parseLang('fr')).toBeNull();
    expect(parseLang('')).toBeNull();
    expect(parseLang(undefined)).toBeNull();
  });

  test('từ chối chữ hoa vì URL luôn viết thường', () => {
    expect(parseLang('VI')).toBeNull();
  });
});

describe('isRetiredLang', () => {
  test('phân biệt ngôn ngữ đã ngừng với ngôn ngữ đang phục vụ', () => {
    expect(isRetiredLang('vi')).toBe(true);
    expect(isRetiredLang('en')).toBe(false);
  });
});

describe('retiredArticleTarget', () => {
  test('trỏ sang bài tiếng Anh cùng article_id', () => {
    expect(retiredArticleTarget('kraton-bans-two-players')).toBe('/en/kraton-bans-two-players');
  });

  test('không có bản tiếng Anh thì trả null để route 404', () => {
    // Đẩy về trang chủ sẽ thành soft-404: Google coi là chuyển hướng không
    // liên quan, bỏ URL khỏi index mà không dồn tín hiệu — tệ hơn 404 thật.
    expect(retiredArticleTarget(null)).toBeNull();
    expect(retiredArticleTarget(undefined)).toBeNull();
    expect(retiredArticleTarget('')).toBeNull();
  });
});

describe('switchableLang', () => {
  // Masthead/Footer từng luôn render link sang ngôn ngữ "kia". Sau khi ngừng
  // tiếng Việt, mọi trang /en tự trỏ hai liên kết nội bộ vào URL 308 — đốt
  // crawl budget và báo cho Google rằng site vẫn coi /vi là đích hợp lệ.
  test('không trả về ngôn ngữ đã ngừng', () => {
    expect(switchableLang('en')).toBeNull();
  });

  test('trang thuộc ngôn ngữ đã ngừng vẫn mời người đọc sang bản đang phục vụ', () => {
    expect(switchableLang('vi')).toBe('en');
  });
});
