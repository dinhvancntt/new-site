import type { RunCounters } from './store.js';

/**
 * Quy tắc vận hành trong spec: quá nửa số bài thất bại thì workflow phải thoát
 * mã khác 0 để GitHub gửi email cho chủ repo. Mẫu số là số bài thực sự được
 * thử viết lại — bài trùng hoặc không rút được thân bài là kết quả bình thường,
 * gộp chúng vào mẫu số sẽ giấu mất một lượt chạy hỏng hoàn toàn.
 */
export function exitCodeFor(counters: RunCounters): number {
  const attempted = counters.written + counters.failed;
  if (attempted === 0) return 0;
  return counters.failed * 2 > attempted ? 1 : 0;
}
