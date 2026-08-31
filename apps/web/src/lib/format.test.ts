import { expect, test } from 'vitest';
import { formatDateTime, formatDay } from './format';

// 04:15 UTC is 11:15 in Hanoi — the site is operated from Vietnam, so both
// language editions timestamp against the same clock.
const published = new Date('2026-08-30T04:15:00.000Z');

test('vietnamese timestamps read day-first in local time', () => {
  expect(formatDateTime(published, 'vi')).toBe('11:15 · 30/08/2026');
});

test('english timestamps spell the month to avoid day/month ambiguity', () => {
  expect(formatDateTime(published, 'en')).toBe('11:15 · 30 Aug 2026');
});

test('day-only format drops the clock', () => {
  expect(formatDay(published, 'vi')).toBe('30/08/2026');
  expect(formatDay(published, 'en')).toBe('30 Aug 2026');
});
