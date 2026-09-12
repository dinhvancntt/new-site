import { describe, expect, test } from 'vitest';
import {
  CATEGORIES,
  CATEGORY_DESCRIPTION,
  CATEGORY_LABEL,
  NAV_CATEGORIES,
  isCategory,
} from './site';
import { LANGS } from './lang';

describe('chuyên mục', () => {
  test('mọi chuyên mục đều có nhãn và mô tả ở cả hai ngôn ngữ', () => {
    for (const lang of LANGS) {
      for (const category of CATEGORIES) {
        expect(CATEGORY_LABEL[lang][category]).toBeTruthy();
        expect(CATEGORY_DESCRIPTION[lang][category]).toBeTruthy();
      }
    }
  });

  test('thanh điều hướng chỉ hiện ngách đang thu thập', () => {
    expect(NAV_CATEGORIES).toEqual(['motorsport', 'cycling', 'equestrian']);
  });

  test('mục trên thanh điều hướng đều là chuyên mục hợp lệ', () => {
    for (const category of NAV_CATEGORIES) {
      expect(isCategory(category)).toBe(true);
    }
  });

  // 249 bài cũ vẫn nằm trong DB và một số đang có thứ hạng; xoá route của chúng
  // là tự tay bẻ những URL Google đã index.
  test('chuyên mục cũ vẫn định tuyến được dù đã ngừng thu thập', () => {
    for (const old of ['world', 'business', 'technology', 'sports', 'health']) {
      expect(isCategory(old)).toBe(true);
    }
  });

  test('bỏ qua chuỗi không phải chuyên mục', () => {
    expect(isCategory('khong-ton-tai')).toBe(false);
  });
});
