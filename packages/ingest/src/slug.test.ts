import { expect, test } from 'vitest';
import { slugify } from './slug.js';

test('bỏ dấu tiếng Việt và nối các từ bằng gạch nối', () => {
  expect(slugify('Giá vàng tăng mạnh trong phiên sáng')).toBe(
    'gia-vang-tang-manh-trong-phien-sang',
  );
});

test('chuyển đ và Đ thành d', () => {
  expect(slugify('Đàm phán về đầu tư')).toBe('dam-phan-ve-dau-tu');
});

test('bỏ ký tự đặc biệt, không để gạch nối thừa ở hai đầu', () => {
  expect(slugify('Mỹ & Trung Quốc: đàm phán "lịch sử"!')).toBe(
    'my-trung-quoc-dam-phan-lich-su',
  );
});

test('cắt slug dài tại ranh giới từ, không cắt giữa chừng', () => {
  const title =
    'Chính phủ công bố kế hoạch phát triển hạ tầng giao thông trọng điểm quốc gia giai đoạn mới';

  expect(slugify(title)).toBe(
    'chinh-phu-cong-bo-ke-hoach-phat-trien-ha-tang-giao-thong-trong-diem-quoc-gia',
  );
});
