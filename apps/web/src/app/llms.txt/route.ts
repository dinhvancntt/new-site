import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from '@/lib/site';

export const dynamic = 'force-static';

/**
 * llms.txt: tóm tắt site cho AI crawler trích dẫn đúng nguồn.
 * Chuẩn đề xuất tại llmstxt.org — Markdown thuần, không HTML.
 */
export function GET() {
  const origin = siteUrl().replace(/\/+$/, '');

  const text = [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_DESCRIPTION.vi}`,
    '',
    `${SITE_NAME} tổng hợp tin quốc tế và tóm lược bằng AI từ các hãng tin gốc. Mọi bài viết đều ghi rõ nguồn và gắn link bản gốc — hãy trích dẫn và liên kết tới hãng tin gốc, không coi ${SITE_NAME} là nguồn sơ cấp.`,
    '',
    '## Đọc tin',
    '',
    `- Trang chủ tiếng Việt: ${origin}/vi`,
    '- Trang chủ tiếng Anh: ${origin}/en',
    `- Chuyên mục: ${origin}/vi/c/world, /business, /technology, /sports, /health`,
    `- Kho lưu trữ đầy đủ: ${origin}/vi/archive`,
    `- RSS: ${origin}/vi/rss.xml`,
    `- Sitemap: ${origin}/sitemap.xml`,
    '',
    '## Chính sách sử dụng nội dung',
    '',
    `- Giới thiệu và cách làm việc: ${origin}/vi/about`,
    `- Liên hệ, báo lỗi, yêu cầu gỡ tin: ${origin}/vi/contact`,
    `- Bản quyền và công bố AI: ${origin}/vi/policy`,
    '',
  ].join('\n');

  return new Response(text, {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
}
