/**
 * Nguồn thu thập, chọn theo ngách thay vì theo chuyên mục rộng của NewsData.
 *
 * Lý do: đo GSC 5 ngày đầu cho thấy bài xếp hạng được đều đến từ tạp chí
 * chuyên ngành (Horse & Hound hạng 6.9, Racing America hạng 9), còn tin
 * mainstream và thông cáo báo chí nằm hạng 15-80. Tin chung có hàng nghìn
 * đối thủ; ngách chỉ có mươi. Whitelist domain cũng loại luôn PR wire
 * (10.8% lượng thu thập cũ) mà không cần excludedomain riêng.
 *
 * Ràng buộc API (đã kiểm chứng bằng key thật): mỗi query tối đa 5 domain,
 * tối đa 10 bài, domain lạ trả HTTP 422. Danh sách dưới đây chỉ gồm domain
 * đã xác nhận có trong index NewsData — phần lớn tạp chí ngành khác không có.
 */
export type Feed = {
  category: string;
  domains: readonly string[];
};

/** NewsData trả 422 "Number of domain cannot exceeded 5 in a single query". */
export const MAX_DOMAINS_PER_QUERY = 5;

export const FEEDS: readonly Feed[] = [
  {
    category: 'motorsport',
    domains: [
      'racer.com',
      'motorsport.com',
      'autosport.com',
      'racingamerica.com',
      'motorsportweek.com',
    ],
  },
  { category: 'cycling', domains: ['cyclingnews.com'] },
  { category: 'equestrian', domains: ['horseandhound.co.uk'] },
];

export function feedCategories(): string[] {
  return FEEDS.map((feed) => feed.category);
}

export function feedDomains(category: string): readonly string[] {
  const feed = FEEDS.find((candidate) => candidate.category === category);
  if (!feed) throw new Error(`Chuyên mục "${category}" không còn được thu thập`);
  return feed.domains;
}
