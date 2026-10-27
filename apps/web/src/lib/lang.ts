export type Lang = 'vi' | 'en';

/**
 * Ngôn ngữ còn xuất bản. Tiếng Việt ngừng từ 2026-10: vị trí trung bình tốt hơn
 * nhưng lượng tìm kiếm quá nhỏ, và site hướng về độc giả Mỹ nên dồn về một ngôn
 * ngữ để không chia đôi tín hiệu xếp hạng.
 */
export const LANGS: readonly Lang[] = ['en'];

/**
 * Ngôn ngữ đã ngừng: URL vẫn phải định tuyến được để 308 sang bản tiếng Anh.
 * Xoá thẳng sẽ ném đi 718 URL đang được lập chỉ mục cùng liên kết trỏ về chúng.
 */
export const RETIRED_LANGS: readonly Lang[] = ['vi'];

/** Ngôn ngữ mặc định, cũng là đích của mọi chuyển hướng từ ngôn ngữ đã ngừng. */
export const DEFAULT_LANG: Lang = 'en';

/** `lang` nhận 'en' (đang phục vụ) và 'vi' (đã ngừng, chỉ để chuyển hướng). */
export function parseLang(value: string | undefined): Lang | null {
  return value === 'vi' || value === 'en' ? value : null;
}

export function isRetiredLang(lang: Lang): boolean {
  return RETIRED_LANGS.includes(lang);
}

/**
 * Đích 308 cho một bài thuộc ngôn ngữ đã ngừng, tra theo slug bản tiếng Anh
 * cùng `article_id`. Trả null khi không có bản tiếng Anh — route phải 404 chứ
 * không được đẩy về trang chủ, vì Google coi chuyển hướng không liên quan là
 * soft-404: URL vẫn bị loại khỏi index mà không dồn được tín hiệu xếp hạng.
 */
export function retiredArticleTarget(enSlug: string | null | undefined): string | null {
  return enSlug ? `/${DEFAULT_LANG}/${enSlug}` : null;
}

export function otherLang(lang: Lang): Lang {
  return lang === 'vi' ? 'en' : 'vi';
}
