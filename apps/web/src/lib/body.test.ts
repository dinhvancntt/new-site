import { expect, test } from 'vitest';
import { toParagraphs } from './body';

test('splits on blank lines', () => {
  expect(toParagraphs('Đoạn một.\n\nĐoạn hai.')).toEqual(['Đoạn một.', 'Đoạn hai.']);
});

test('also splits on single newlines, because the model emits either', () => {
  expect(toParagraphs('Đoạn một.\nĐoạn hai.')).toEqual(['Đoạn một.', 'Đoạn hai.']);
});

test('drops blank runs and trims stray whitespace', () => {
  expect(toParagraphs('  Một.  \n\n\n\n   \n  Hai.\n')).toEqual(['Một.', 'Hai.']);
});

test('a body with no break is a single paragraph', () => {
  expect(toParagraphs('Chỉ một đoạn.')).toEqual(['Chỉ một đoạn.']);
});

test('an empty body yields nothing to render', () => {
  expect(toParagraphs('')).toEqual([]);
  expect(toParagraphs('   \n  ')).toEqual([]);
});
