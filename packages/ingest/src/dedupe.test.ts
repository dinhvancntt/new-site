import { expect, test } from 'vitest';
import { selectNewArticles, titleHash } from './dedupe.js';

const article = (sourceId: string, title: string) => ({ sourceId, title });

test('cùng một tiêu đề khác hoa thường, dấu câu và khoảng trắng cho ra cùng hash', () => {
  const a = titleHash('Vietnam, US Reach  Trade Deal');
  const b = titleHash('vietnam us reach trade deal!');

  expect(a).toBe(b);
});

test('bỏ qua bài đã có trong kho theo source_id', () => {
  const fetched = [article('news-1', 'Bài cũ'), article('news-2', 'Bài mới')];

  const result = selectNewArticles(fetched, {
    sourceIds: new Set(['news-1']),
    titleHashes: new Set(),
  });

  expect(result.map((a) => a.sourceId)).toEqual(['news-2']);
});

test('bỏ qua bài trùng tiêu đề với bài đã có dù source_id khác', () => {
  const fetched = [article('news-9', 'Vietnam, US Reach Trade Deal')];

  const result = selectNewArticles(fetched, {
    sourceIds: new Set(),
    titleHashes: new Set([titleHash('vietnam us reach trade deal')]),
  });

  expect(result).toEqual([]);
});

test('chỉ giữ một bài khi cùng mẻ có hai tiêu đề trùng nhau', () => {
  const fetched = [
    article('news-1', 'Giá vàng lập đỉnh'),
    article('news-2', 'Giá vàng lập đỉnh!'),
  ];

  const result = selectNewArticles(fetched, {
    sourceIds: new Set(),
    titleHashes: new Set(),
  });

  expect(result.map((a) => a.sourceId)).toEqual(['news-1']);
});
