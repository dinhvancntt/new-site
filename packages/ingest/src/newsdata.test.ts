import { expect, test } from 'vitest';
import { fetchCategory } from './newsdata.js';

const rawArticle = {
  article_id: 'abc123',
  title: 'Vietnam and US reach trade deal',
  description: 'Hai nước đạt thỏa thuận sau nhiều vòng đàm phán.',
  link: 'https://example.com/a',
  image_url: 'https://example.com/a.jpg',
  source_name: 'Example News',
  pubDate: '2026-08-30 04:15:00',
};

const fakeFetch = (body: unknown, status = 200) =>
  async () => new Response(JSON.stringify(body), { status });

test('chuyển bài từ NewsData sang cấu trúc nội bộ', async () => {
  const articles = await fetchCategory({
    apiKey: 'test-key',
    category: 'world',
    fetchImpl: fakeFetch({ status: 'success', results: [rawArticle] }),
  });

  expect(articles).toEqual([
    {
      sourceId: 'abc123',
      title: 'Vietnam and US reach trade deal',
      description: 'Hai nước đạt thỏa thuận sau nhiều vòng đàm phán.',
      link: 'https://example.com/a',
      imageUrl: 'https://example.com/a.jpg',
      sourceName: 'Example News',
      category: 'world',
      publishedAt: new Date('2026-08-30T04:15:00Z'),
    },
  ]);
});

test('bỏ bài thiếu tiêu đề, link hoặc ngày đăng hợp lệ', async () => {
  const articles = await fetchCategory({
    apiKey: 'test-key',
    category: 'world',
    fetchImpl: fakeFetch({
      status: 'success',
      results: [
        { ...rawArticle, article_id: 'thieu-tieu-de', title: null },
        { ...rawArticle, article_id: 'thieu-link', link: null },
        { ...rawArticle, article_id: 'ngay-hong', pubDate: 'không phải ngày' },
        rawArticle,
      ],
    }),
  });

  expect(articles.map((a) => a.sourceId)).toEqual(['abc123']);
});

test('ném lỗi kèm mã trạng thái khi NewsData trả lỗi', async () => {
  const call = fetchCategory({
    apiKey: 'test-key',
    category: 'world',
    fetchImpl: fakeFetch({ status: 'error', message: 'Rate limit exceeded' }, 429),
  });

  await expect(call).rejects.toThrow(/429/);
});
