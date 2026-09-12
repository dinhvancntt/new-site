import { expect, test } from 'vitest';
import { FEEDS, MAX_DOMAINS_PER_QUERY, feedCategories, feedDomains } from './feeds.js';

test('mỗi feed nằm trong trần 5 domain của một query NewsData', () => {
  for (const feed of FEEDS) {
    expect(feed.domains.length).toBeGreaterThan(0);
    expect(feed.domains.length).toBeLessThanOrEqual(MAX_DOMAINS_PER_QUERY);
  }
});

test('không có chuyên mục trùng nhau', () => {
  const names = feedCategories();
  expect(new Set(names).size).toBe(names.length);
});

test('một domain chỉ thuộc đúng một chuyên mục', () => {
  const all = FEEDS.flatMap((feed) => feed.domains);
  expect(new Set(all).size).toBe(all.length);
});

test('feedDomains tra được domain của chuyên mục', () => {
  expect(feedDomains('motorsport')).toContain('racer.com');
});

// Chuyên mục cũ vẫn còn bài trong DB nhưng không còn được thu thập nữa;
// gọi nhầm phải nổ ngay thay vì lặng lẽ fetch rỗng.
test('feedDomains ném lỗi với chuyên mục không còn thu thập', () => {
  expect(() => feedDomains('world')).toThrow(/world/);
});
