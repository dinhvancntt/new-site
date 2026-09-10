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

const withImage = async (image_url: unknown) => {
  const [article] = await fetchCategory({
    apiKey: 'test-key',
    category: 'world',
    fetchImpl: fakeFetch({ status: 'success', results: [{ ...rawArticle, image_url }] }),
  });
  return article?.imageUrl ?? null;
};

test('loại pixel theo dõi của PR Newswire ra khỏi ảnh bài', async () => {
  expect(
    await withImage(
      'https://rt.prnewswire.com/rt.gif?NewsItemId=EN43545&Transmission_Id=202609091001PR_NEWS_EURO_ND__EN43545',
    ),
  ).toBeNull();
});

test('loại mọi ảnh .gif vì wire feed chỉ dùng gif cho beacon', async () => {
  expect(await withImage('https://cdn.example.com/photos/spacer.gif')).toBeNull();
});

test('loại pixel đặt tên khác nhưng vẫn là beacon', async () => {
  expect(await withImage('https://stats.example.com/beacon?id=9')).toBeNull();
  expect(await withImage('https://example.com/track/1x1.png')).toBeNull();
});

test('loại URL không phải http', async () => {
  expect(await withImage('data:image/gif;base64,R0lGOD')).toBeNull();
  expect(await withImage('/relative/path.jpg')).toBeNull();
});

test('giữ nguyên ảnh thật', async () => {
  expect(await withImage('https://images.example.com/2026/09/photo.jpg')).toBe(
    'https://images.example.com/2026/09/photo.jpg',
  );
  expect(await withImage('https://images.example.com/a.webp?w=1200')).toBe(
    'https://images.example.com/a.webp?w=1200',
  );
});
