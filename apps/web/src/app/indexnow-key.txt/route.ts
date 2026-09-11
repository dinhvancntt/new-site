/**
 * File khoá IndexNow. Đặt ở đường dẫn cố định và trả khoá lấy từ env, để khoá
 * gửi kèm mỗi lần submit luôn khớp khoá đang được phục vụ — lệch một nhịp là
 * Bing từ chối cả mẻ URL.
 */
export const dynamic = 'force-dynamic';

export function GET(): Response {
  const key = process.env['INDEXNOW_KEY'];
  if (!key) return new Response('Not found', { status: 404 });

  return new Response(key, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
