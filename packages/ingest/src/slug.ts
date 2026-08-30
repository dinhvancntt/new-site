const COMBINING_MARKS = /[̀-ͯ]/g;
const MAX_SLUG_LENGTH = 80;

/**
 * Bỏ dấu, chữ thường. Dùng cho cả `search_text` khi ghi lẫn chuỗi người dùng
 * nhập khi tìm kiếm — hai bên phải dùng đúng một hàm (spec mục Tìm kiếm).
 */
export function removeDiacritics(input: string): string {
  return input
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase();
}

export function slugify(input: string): string {
  const slug = removeDiacritics(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length <= MAX_SLUG_LENGTH) return slug;

  const cut = slug.slice(0, MAX_SLUG_LENGTH + 1);
  const lastBoundary = cut.lastIndexOf('-');
  return lastBoundary > 0 ? cut.slice(0, lastBoundary) : cut.slice(0, MAX_SLUG_LENGTH);
}
