import { readFileSync } from 'node:fs';

// .env chứa URL có ký tự & nên không source được bằng shell; tự parse.
try {
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
} catch {
  // Không có .env thì dựa vào biến môi trường sẵn có (CI).
}
