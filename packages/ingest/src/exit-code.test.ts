import { expect, test } from 'vitest';
import { exitCodeFor } from './exit-code.js';
import type { RunCounters } from './store.js';

function counters(over: Partial<RunCounters> = {}): RunCounters {
  return { fetched: 0, skippedDup: 0, skippedExtract: 0, written: 0, failed: 0, ...over };
}

test('a run with no failures exits zero', () => {
  expect(exitCodeFor(counters({ fetched: 10, written: 10 }))).toBe(0);
});

test('a minority of failures still exits zero', () => {
  expect(exitCodeFor(counters({ fetched: 10, written: 6, failed: 4 }))).toBe(0);
});

test('more than half the attempted articles failing exits non-zero', () => {
  expect(exitCodeFor(counters({ fetched: 10, written: 4, failed: 6 }))).toBe(1);
});

test('failures are measured against articles actually attempted, not articles fetched', () => {
  // 8 trong 10 bài bị bỏ vì trùng hoặc không rút được thân bài; chỉ 2 bài được
  // thử viết lại và cả hai đều hỏng — đó là lượt chạy hỏng, dù 2 < 10/2.
  const c = counters({ fetched: 10, skippedDup: 5, skippedExtract: 3, written: 0, failed: 2 });
  expect(exitCodeFor(c)).toBe(1);
});

test('a run that attempted nothing exits zero', () => {
  expect(exitCodeFor(counters({ fetched: 6, skippedDup: 6 }))).toBe(0);
});
