const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

export type Beacon = { src: string; data: string };

/**
 * Cloudflare Web Analytics: chỉ nhúng khi đã có token.
 * Không có token thì trả null để layout không render thẻ script rỗng —
 * site vẫn chạy bình thường ở môi trường dev/preview.
 */
export function cfBeacon(token: string | undefined): Beacon | null {
  const trimmed = token?.trim();
  if (!trimmed) return null;

  return { src: BEACON_SRC, data: JSON.stringify({ token: trimmed }) };
}
