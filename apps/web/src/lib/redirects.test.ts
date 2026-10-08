import { describe, expect, test } from 'vitest';
import config from '../../next.config';

// `/` không có nội dung riêng mà chuyển sang `/vi` (ngôn ngữ mặc định, cũng là
// hreflang x-default). Chuyển hướng phải là 308 permanent, nếu không Google giữ
// `/` lại trong index như một URL riêng và báo trùng lặp với `/vi`.
describe('chuyển hướng trang gốc', () => {
  test('/ chuyển vĩnh viễn sang /vi', async () => {
    const redirects = await config.redirects!();
    const root = redirects.find((r) => r.source === '/');

    expect(root).toBeDefined();
    expect(root!.destination).toBe('/vi');
    expect(root!.permanent).toBe(true);
  });
});
