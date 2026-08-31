/**
 * Ảnh bài lấy từ CDN của hãng tin nên host là bất kỳ: không lập được allowlist
 * cho `next/image`, mà bật `hostname: '**'` thì biến domain mình thành proxy ảnh
 * công cộng, lại đốt hết 5K transformation/tháng của Vercel Hobby chỉ sau vài
 * ngày. Nên đẩy việc thu nhỏ sang wsrv.nl — miễn phí, không quota.
 *
 * Toàn bộ site dựng URL ảnh qua đúng hàm này, nên đổi nhà cung cấp là sửa một chỗ.
 */
const RESIZER = 'https://wsrv.nl/';

export type ImageSize = {
  width: number;
  /** Có height thì ảnh bị cắt vào đúng khung, dùng cho lưới tin đều nhau. */
  height?: number;
};

export function imageUrl(src: string | null | undefined, size: ImageSize): string | null {
  if (!src) return null;

  let parsed: URL;
  try {
    parsed = new URL(src);
  } catch {
    return null;
  }

  // Chặn `javascript:`, `data:` và mọi scheme lạ trước khi nhúng vào thẻ img.
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  // Tự ghép thay vì URLSearchParams: nó mã hoá dấu cách thành `+`, còn
  // encodeURIComponent cho `%20` — nghĩa duy nhất một cách ở mọi bộ phân tích.
  const params = [`url=${encodeURIComponent(src)}`, `w=${size.width}`];
  if (size.height !== undefined) {
    params.push(`h=${size.height}`, 'fit=cover');
  }
  params.push('output=webp');
  // `we` = without enlargement: ảnh nguồn nhỏ hơn thì giữ nguyên, không phóng to vỡ hạt.
  params.push('we');

  return `${RESIZER}?${params.join('&')}`;
}
