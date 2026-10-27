import { describe, expect, test } from 'vitest';
import config from '../../next.config';

const load = async () => await config.redirects!();
const find = async (source: string) => (await load()).find((r) => r.source === source);

// Tiếng Việt ngừng xuất bản từ 2026-10. 718 URL /vi đang được lập chỉ mục nên
// không được xoá thẳng: mỗi URL phải 308 sang bản tiếng Anh tương ứng để dồn
// tín hiệu xếp hạng thay vì vứt đi.
describe('chuyển hướng trang gốc', () => {
  test('/ chuyển vĩnh viễn sang /en', async () => {
    const root = await find('/');

    expect(root).toBeDefined();
    expect(root!.destination).toBe('/en');
    expect(root!.permanent).toBe(true);
  });
});

describe('chuyển hướng tiếng Việt đã ngừng', () => {
  test('trang chủ /vi về /en', async () => {
    const home = await find('/vi');

    expect(home).toBeDefined();
    expect(home!.destination).toBe('/en');
    expect(home!.permanent).toBe(true);
  });

  test.each([
    ['/vi/about', '/en/about'],
    ['/vi/archive', '/en/archive'],
    ['/vi/contact', '/en/contact'],
    ['/vi/policy', '/en/policy'],
    ['/vi/search', '/en/search'],
    ['/vi/rss.xml', '/en/rss.xml'],
  ])('%s về %s', async (source, destination) => {
    const rule = await find(source);

    expect(rule).toBeDefined();
    expect(rule!.destination).toBe(destination);
    expect(rule!.permanent).toBe(true);
  });

  test('chuyên mục giữ nguyên tên mục khi chuyển', async () => {
    const rule = await find('/vi/c/:category');

    expect(rule).toBeDefined();
    expect(rule!.destination).toBe('/en/c/:category');
    expect(rule!.permanent).toBe(true);
  });

  test('không có luật bắt tất cả, vì slug bài phải tra bản tiếng Anh trong DB', async () => {
    // `/vi/:path*` sẽ đẩy /vi/<slug-tiếng-việt> sang /en/<slug-tiếng-việt> —
    // một URL không tồn tại. Slug phải do route [lang]/[slug] tra siblingSlug.
    const wildcards = (await load()).filter((r) => r.source.includes('*'));

    expect(wildcards).toEqual([]);
  });
});
