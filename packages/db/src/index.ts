import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
// Import không đuôi (khác phần còn lại của repo): đây là cửa ngõ mà apps/web đi
// vào, và Turbopack không đổi './schema.js' thành './schema.ts' như tsx/vitest.
import * as schema from './schema';

export * from './schema';
export * from './text';

export function createDb(url = process.env['DATABASE_URL']) {
  if (!url) throw new Error('DATABASE_URL chưa được đặt');
  return drizzle(postgres(url, { max: 5 }), { schema });
}

export type Db = ReturnType<typeof createDb>;
