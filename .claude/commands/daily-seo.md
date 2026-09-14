---
description: Chọn chủ đề theo tín hiệu xếp hạng, viết một bài chuẩn SEO song ngữ và đăng thẳng lên site
allowed-tools: Bash(npm run ranks), Bash(npm run recent), Bash(npm run recent -- *), Bash(npm run publish -- *), WebSearch, WebFetch, Read, Write
---

# Bài SEO hằng ngày

Chạy trọn vẹn, **không hỏi lại người dùng câu nào**. Mọi quyết định đã có tiêu
chí ở dưới; gặp mơ hồ thì chọn theo tiêu chí rồi ghi lại lựa chọn trong báo cáo
cuối. Chỉ dừng giữa chừng khi `npm run publish` từ chối bản thảo ba lần liên
tiếp vì cùng một lỗi.

## 1. Lấy tín hiệu xếp hạng

```
npm run ranks
npm run recent -- 40
```

`ranks` in ra hai phần: truy vấn trong tầm với trang 1 lấy từ Search Console
(nếu đã cấu hình khoá) và gợi ý autocomplete theo từng ngách. `recent` là 40
bài đã đăng.

## 2. Chọn đúng một chủ đề

Thứ tự ưu tiên:

1. Truy vấn ở mục "trong tầm với trang 1" — Google đã xếp hạng trang cho truy
   vấn này, một bài tốt là đủ để lên trang 1. Đây luôn là lựa chọn tốt nhất.
2. Gợi ý autocomplete có ý định rõ ràng và trả lời được bằng một bài viết.

Loại bỏ:

- Chủ đề trùng hoặc gần trùng một bài trong danh sách `recent` — hai bài cùng
  nhắm một truy vấn thì tự cạnh tranh nhau.
- Truy vấn điều hướng ("f1 live stream") hoặc giao dịch ("horses for sale") —
  người gõ muốn một trang dịch vụ, không muốn đọc bài.
- Truy vấn cần số liệu trực tiếp đang thay đổi từng phút (bảng điểm hôm nay).

Xoay vòng chuyên mục: nếu bài gần nhất trong `recent` thuộc ngách nào thì ưu
tiên ngách khác.

## 3. Nghiên cứu

Dùng WebSearch và WebFetch, thu ít nhất **hai nguồn độc lập** cho mọi dữ kiện
quan trọng. Ghi lại URL — `publish` sẽ từ chối bản thảo dưới hai nguồn.

Không bịa số liệu, ngày tháng, phát biểu. Không chắc thì bỏ chi tiết đó.

## 4. Viết bản thảo

Ghi ra `drafts/YYYY-MM-DD-<slug>.json`:

```json
{
  "category": "motorsport | cycling | equestrian",
  "keyword": "truy vấn đã chọn, viết thường",
  "model": "claude-opus-5",
  "primarySource": { "name": "Autosport", "url": "https://..." },
  "sources": ["https://...", "https://..."],
  "imageUrl": null,
  "tags": ["3 đến 6 thẻ viết thường"],
  "en": { "title": "...", "summary": "...", "body": "..." },
  "vi": { "title": "...", "summary": "...", "body": "..." }
}
```

Ràng buộc được kiểm bằng code, không phải lời khuyên:

- `title` 40-65 ký tự; keyword phải nằm trong `en.title`.
- `summary` 120-165 ký tự, đọc như một câu mời đọc chứ không phải tóm tắt cụt.
- `body` 500-1200 từ, tối thiểu 5 đoạn, phân cách bằng một dòng trống.
- Mật độ keyword trong `en.body` không quá 3%.
- `tags` viết thường, 3-6 thẻ.
- Không để lại TODO, TBD, XXX hay chỗ trống.

Bản tiếng Việt là **bài viết độc lập cho người đọc Việt**, không phải bản dịch
từng câu: tiêu đề riêng, ví dụ và cách giải thích hợp với người đọc trong nước.

Mở bài trả lời thẳng truy vấn trong 2 câu đầu — người tìm kiếm muốn câu trả
lời, không muốn đoạn dẫn nhập. Phần sau mới khai triển bối cảnh.

## 5. Đăng

```
npm run publish -- drafts/<tên-file>.json
```

Lệnh này tự kiểm chuẩn SEO, ghi vào database trong một transaction và báo URL
mới cho Bing/Yandex qua IndexNow. Bị từ chối thì sửa đúng lỗi được in ra rồi
chạy lại — đừng nới tiêu chí.

## 6. Báo cáo

Ba đến năm dòng: chủ đề đã chọn và vì sao (tín hiệu nào), đường dẫn hai ngôn
ngữ, nguồn đã dùng, và chủ đề đáng viết tiếp trong lần chạy sau.
