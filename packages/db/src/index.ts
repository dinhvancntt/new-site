import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export * from './schema.js';
export * from './text.js';

export function createDb(url = process.env['DATABASE_URL']) {
  if (!url) throw new Error('DATABASE_URL chưa được đặt');
  return drizzle(postgres(url, { max: 5 }), { schema });
}

export type Db = ReturnType<typeof createDb>;
