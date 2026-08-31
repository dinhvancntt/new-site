import type { Lang } from './lang';

/** Site vận hành từ Việt Nam nên cả hai bản ngôn ngữ đóng dấu cùng một đồng hồ. */
const TIME_ZONE = 'Asia/Ho_Chi_Minh';

// Lấy từng thành phần rồi tự ghép: chuỗi ra không phụ thuộc vào cách mỗi
// runtime chấm câu cho từng locale, nên format là cố định và test được.
function parts(date: Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const formatted = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, ...options })
    .formatToParts(date)
    .map((part) => [part.type, part.value] as const);

  return Object.fromEntries(formatted);
}

export function formatDay(date: Date, lang: Lang): string {
  if (lang === 'vi') {
    const p = parts(date, { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${p.day}/${p.month}/${p.year}`;
  }

  const p = parts(date, { day: '2-digit', month: 'short', year: 'numeric' });
  return `${p.day} ${p.month} ${p.year}`;
}

export function formatTime(date: Date): string {
  const p = parts(date, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${p.hour}:${p.minute}`;
}

export function formatDateTime(date: Date, lang: Lang): string {
  return `${formatTime(date)} · ${formatDay(date, lang)}`;
}
