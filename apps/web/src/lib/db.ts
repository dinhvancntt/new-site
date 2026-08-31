import { createDb, type Db } from '@news/db';

// Dev server nạp lại module liên tục; không giữ ở globalThis thì mỗi lần nạp lại
// mở thêm một pool và Neon free tier hết slot kết nối rất nhanh.
const cache = globalThis as typeof globalThis & { __newsDb?: Db };

/** Gọi lúc render chứ không phải lúc import: build không cần DATABASE_URL để thu thập route. */
export function getDb(): Db {
  cache.__newsDb ??= createDb();
  return cache.__newsDb;
}
