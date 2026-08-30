# Thiết kế: Website tin tức tổng hợp tự động, song ngữ Việt–Anh

Ngày: 2026-08-30

## 1. Mục tiêu

Một trang tin tức chạy hoàn toàn tự động: định kỳ lấy tin quốc tế từ API, viết lại thành bài tiếng Việt và tiếng Anh bằng Claude, rồi đăng ngay không cần người duyệt. Không có toà soạn, không có trang quản trị.

Thành công nghĩa là: mỗi ngày có tin mới, tin đọc tự nhiên bằng cả hai thứ tiếng, mọi bài đều dẫn được về nguồn gốc, và khi pipeline hỏng thì chủ site biết ngay.

## 2. Phạm vi

Trong phạm vi:

- Thu thập tin từ NewsData.io theo chuyên mục.
- Viết lại song ngữ bằng `claude-opus-5`.
- Trang công khai: trang chủ, chuyên mục, trang bài, tìm kiếm, RSS, sitemap.
- Chuyển đổi ngôn ngữ Việt/Anh trên toàn site.
- Nhật ký mỗi lượt thu thập và cảnh báo khi thất bại.

Ngoài phạm vi ở giai đoạn này:

- Trang quản trị, đăng nhập, phân quyền.
- Bình luận, tài khoản người đọc, bản tin email.
- Quảng cáo, phân tích truy cập.
- Ứng dụng di động.

## 3. Kiến trúc

Hai nửa tách rời, chỉ dùng chung tầng dữ liệu:

```
news-site/
├─ apps/web/                     Next.js 15 App Router — chỉ ĐỌC
├─ packages/db/                  Drizzle schema + client (dùng chung)
├─ packages/ingest/              worker thu thập + viết lại — chỉ GHI
└─ .github/workflows/ingest.yml  GitHub Actions cron
```

Quản lý bằng pnpm workspaces. `packages/ingest` không import bất cứ thứ gì từ `apps/web` và ngược lại; đường liên lạc duy nhất giữa hai bên là `packages/db`.

### 3.1 Vì sao worker chạy trên GitHub Actions, không phải Vercel Cron

Đã kiểm chứng trên tài liệu Vercel (cập nhật 2026-08-25):

- Vercel Hobby: function tối đa 60 giây; cron chỉ kích hoạt một lần mỗi ngày và không đảm bảo đúng giờ.
- Viết lại 20–30 bài mỗi lượt mất vài phút, vượt xa 60 giây.
- Muốn cron theo phút phải nâng lên Pro (khoảng $20 một tháng).

GitHub Actions không vướng giới hạn thời gian ở mức này, miễn phí, có sẵn log và tự gửi email khi workflow thất bại. Vercel do đó chỉ phục vụ đọc; không bao giờ gọi Claude trong request của người dùng.

### 3.2 Ràng buộc hạ tầng đã biết

- Vercel Hobby **không** kết nối được với repo thuộc GitHub organization. Repo phải nằm dưới tài khoản cá nhân.
- Neon Postgres free tier cho giai đoạn đầu. Tạo hai role: một role ghi cho worker, một role chỉ đọc cho web.

## 4. Luồng thu thập

Chạy mỗi 3 giờ. Năm bước, mỗi bước là một hàm thuần nhận input trả output nên test được mà không cần mạng.

### Bước 1 — Fetch

Gọi NewsData.io cho từng chuyên mục cấu hình sẵn: `world`, `business`, `technology`, `sports`, `health`. Ngôn ngữ nguồn là tiếng Anh.

### Bước 2 — Dedupe

Loại bài đã có trong DB:

- Khóa chính: `source_id`, chính là `article_id` của NewsData.
- Khóa phụ: `title_hash` = sha256 của tiêu đề tiếng Anh sau khi chuẩn hóa (chữ thường, bỏ dấu câu, gom khoảng trắng). Khóa này bắt trường hợp cùng một tin xuất hiện lại dưới id khác.

### Bước 3 — Extract

Tải HTML bài gốc theo `link`, rút phần thân bài bằng `@mozilla/readability` trên `jsdom`.

**Nếu tải hoặc rút thất bại — paywall, chặn bot, trang rỗng — thì bỏ hẳn bài đó.** Đây là cơ chế chặn bịa đặt: NewsData chỉ trả mô tả khoảng 150 chữ, và bắt model viết 3–5 đoạn từ chừng đó thì nó buộc phải bịa chi tiết. Không có thân bài gốc thì không viết bài. Số bài bị bỏ được đếm vào `ingest_runs.skipped_extract`.

Ngưỡng tối thiểu: thân bài phải từ 400 ký tự trở lên mới coi là rút thành công.

### Bước 4 — Rewrite

Một lệnh gọi `claude-opus-5` cho mỗi bài.

- `output_config.format`: JSON schema với `strict: true`, trả về đúng một object gồm `title_vi`, `title_en`, `summary_vi`, `summary_en`, `body_vi`, `body_en`, `tags`, `insufficient`. Không hỏi model về `category` — chuyên mục lấy từ chuyên mục đã gọi ở bước Fetch, đó là nguồn duy nhất.
- `thinking: {type: "adaptive"}`.
- `output_config.effort: "medium"` — viết lại tin là việc có khuôn sẵn.
- `betas: ["server-side-fallback-2026-07-01"]` cộng `fallbacks: "default"`. Tin thời sự hay chạm chủ đề chiến sự, tội phạm, y tế nhạy cảm; không có fallback thì gặp `stop_reason: "refusal"` là mất bài. Vẫn phải kiểm tra `stop_reason` trước khi đọc `content`; bài nào vẫn bị từ chối thì đếm vào `failed` và **không đăng**.
- `max_tokens: 8000`, không cần streaming vì đầu ra khoảng 3–4K token.
- Prompt caching: toàn bộ hướng dẫn viết và style guide nằm trong `system` và cố định giữa các bài, nên gắn `cache_control: {type: "ephemeral"}`. Lượt 30 bài thì 29 bài đọc cache.
- Chạy song song tối đa 3 bài để tránh chạm rate limit.
- `maxRetries: 4` trên client, mặc định SDK là 2.

Ràng buộc ghi rõ trong `system`:

- Chỉ dùng dữ kiện có trong thân bài gốc được cung cấp.
- Không thêm số liệu, ngày tháng, tên riêng hay trích dẫn không có trong bài gốc.
- Không suy đoán nguyên nhân, hệ quả hay diễn biến tiếp theo.
- Không nêu ý kiến, không đứng về phía nào.
- Bản tiếng Việt phải là văn viết báo tự nhiên, không dịch từng chữ.
- Nếu bài gốc không đủ dữ kiện để viết, đặt `insufficient: true` thay vì viết bừa. Bài như vậy bị bỏ.

### Bước 5 — Store

Ghi vào Postgres trong một transaction cho mỗi bài, kèm `source_name`, `source_url`, `image_url`, `published_at` để luôn dẫn nguồn được.

## 5. Mô hình dữ liệu

`articles` — phần không phụ thuộc ngôn ngữ:

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid pk | |
| `source_id` | text unique not null | `article_id` của NewsData |
| `title_hash` | text unique not null | chống trùng lần hai |
| `source_name` | text not null | hiển thị "theo <nguồn>" |
| `source_url` | text not null | nút Đọc bản gốc |
| `image_url` | text null | |
| `category` | text not null | |
| `published_at` | timestamptz not null | thời điểm bài gốc đăng |
| `ingested_at` | timestamptz default now() | |
| `model` | text not null | model đã dùng, ví dụ `claude-opus-5` |

`article_contents` — phần theo ngôn ngữ:

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `article_id` | uuid fk → articles.id, on delete cascade | |
| `lang` | text not null | `vi` hoặc `en` |
| `slug` | text not null | |
| `title` | text not null | |
| `summary` | text not null | |
| `body` | text not null | markdown |
| `search_text` | text not null | `title` + `summary` đã bỏ dấu, chữ thường — do worker tính khi ghi |
| `search_vector` | tsvector generated | `to_tsvector('simple', search_text)` |

Ràng buộc: unique(`article_id`, `lang`), unique(`lang`, `slug`).

Tách bảng này không phải để chuẩn bị cho ngôn ngữ thứ ba, mà vì mọi truy vấn theo locale khi đó chỉ là `where lang = $1`. Nếu để cột phẳng `title_vi` và `title_en` thì mỗi truy vấn phải chọn tên cột theo biến.

`ingest_runs` — nhật ký vận hành:

| Cột | Kiểu |
|---|---|
| `id` | uuid pk |
| `started_at`, `finished_at` | timestamptz |
| `fetched`, `skipped_dup`, `skipped_extract`, `written`, `failed` | integer |
| `error` | text null |

Vì site không có trang quản trị, bảng này là cách duy nhất biết pipeline còn sống và hỏng ở khâu nào.

Index:

- `articles(published_at desc)`
- `articles(category, published_at desc)`
- GIN trên `article_contents.search_vector`

Tìm kiếm: bỏ dấu ở tầng ứng dụng chứ **không** dùng `unaccent()` trong cột generated. Lý do kỹ thuật: `unaccent()` không phải hàm IMMUTABLE nên Postgres từ chối dùng nó trong `GENERATED ALWAYS AS`; muốn dùng phải bọc một hàm immutable tự viết, và đó là bẫy đã biết. Thay vào đó worker tự chuẩn hóa vào `search_text`, cột generated chỉ gọi `to_tsvector('simple', ...)` vốn immutable. Truy vấn tìm kiếm cũng bỏ dấu chuỗi người dùng nhập bằng đúng hàm đó.

Hệ quả: tìm có dấu hay không dấu đều ra, nhưng không stem được (Postgres không có bộ phân tích tiếng Việt). Đủ tốt cho site tin.

## 6. Ứng dụng web

Next.js 15 App Router, TypeScript, Tailwind. Chỉ đọc DB.

| Đường dẫn | Nội dung |
|---|---|
| `/` | chuyển hướng `/vi` |
| `/[lang]` | trang chủ |
| `/[lang]/c/[category]` | chuyên mục |
| `/[lang]/[slug]` | trang bài |
| `/[lang]/search?q=` | tìm kiếm |
| `/[lang]/rss.xml` | RSS |
| `/sitemap.xml` | sitemap cả hai ngôn ngữ |

`lang` chỉ nhận `vi` hoặc `en`; giá trị khác trả 404.

- ISR: trang chủ và chuyên mục `revalidate: 300`. Trang bài không revalidate vì nội dung cố định sau khi đăng.
- Hai bản ngôn ngữ của cùng một bài trỏ về nhau bằng thẻ `hreflang`.
- Nút chuyển ngôn ngữ giữ nguyên bài đang đọc: tra `article_id` rồi lấy slug của ngôn ngữ kia.
- Ảnh qua `next/image` với `remotePatterns` giới hạn theo host của nguồn.

Mỗi trang bài bắt buộc có: tên nguồn, thời điểm đăng gốc, nút **Đọc bản gốc**, và dòng ghi chú "Nội dung được tóm lược tự động bằng AI từ <nguồn>".

Thẩm mỹ: hướng báo nghiêm túc kiểu Reuters/AP — chữ serif cho tiêu đề, mật độ tin dày, ít màu, ưu tiên quét tiêu đề nhanh. Chi tiết chốt ở bước triển khai bằng skill `frontend-design`.

## 7. Vận hành và xử lý lỗi

- Mỗi bài xử lý độc lập bằng `Promise.allSettled` theo lô 3. Một bài hỏng chỉ cộng vào `ingest_runs.failed`, không làm sập cả lượt.
- Lỗi 429 để SDK tự retry với backoff.
- Nếu quá 50% số bài trong một lượt thất bại, workflow thoát mã lỗi khác 0 nên GitHub tự gửi email cho chủ repo. Không cần dựng hệ thống giám sát riêng.
- Secrets trong GitHub Secrets: `ANTHROPIC_API_KEY`, `NEWSDATA_API_KEY`, `DATABASE_URL` của role ghi.
- Vercel chỉ giữ `DATABASE_URL` của role chỉ đọc.

## 8. Kiểm thử

Viết test trước theo TDD khi triển khai.

Unit:

- Chuẩn hóa tiêu đề và sinh `title_hash`.
- Dedupe theo cả hai khóa.
- Slugify tiếng Việt: bỏ dấu, xử lý `đ` và `Đ`, gom ký tự lạ, chống trùng slug.
- Rút thân bài từ các file HTML mẫu lưu sẵn trong repo, gồm một mẫu paywall để khẳng định bài bị bỏ.
- Parse phản hồi Claude từ fixture JSON, gồm trường hợp `insufficient: true` và `stop_reason: "refusal"`.

Integration:

- Chạy trọn pipeline với NewsData và Claude được mock, đối chiếu kết quả trong Postgres.

Ngoài CI:

- Một test gọi API thật, chạy tay khi cần, không đưa vào CI vì tốn tiền và phụ thuộc mạng.

Chưa test giao diện tự động ở giai đoạn này.

## 9. Chi phí dự kiến

Với 30 bài mỗi ngày, mỗi bài khoảng 2.5K token vào và 2.5K token ra, dùng `claude-opus-5` ở mức $5 và $25 mỗi triệu token:

- Đầu vào: 900 bài × 2.5K = 2.25M token × $5 = khoảng $11 một tháng.
- Đầu ra: 900 bài × 2.5K = 2.25M token × $25 = khoảng $56 một tháng.
- Tổng khoảng **$67 một tháng**, tức $0.075 một bài.

Về prompt caching, phải nói thẳng: khoản tiết kiệm ở đây **nhỏ**, cỡ $2–3 một tháng. Lý do là trong 2.5K token đầu vào mỗi bài thì khoảng 2K là thân bài gốc — khác nhau hoàn toàn giữa các bài, không cache được; chỉ phần `system` khoảng 500 token là cố định. Tệ hơn, tiền tố ngắn hơn ngưỡng tối thiểu của model sẽ **âm thầm không cache**, nên bắt buộc phải kiểm `usage.cache_read_input_tokens` sau lượt đầu; nếu bằng 0 thì hoặc bỏ `cache_control` đi cho gọn, hoặc viết `system` dài hơn ngưỡng. Chi phí thật nằm ở token đầu ra, và cách duy nhất giảm nó là viết bài ngắn hơn hoặc đổi model.

Neon, Vercel và GitHub Actions đều nằm trong free tier ở quy mô này.

Con số này phải đo lại bằng `response.usage` thật sau lượt ingest đầu tiên.

## 10. Việc phải làm trước khi viết code

1. Đăng ký NewsData.io, lấy key, và **ghi nhận hạn mức thực tế của free tier**: số credit mỗi ngày, số bài mỗi request, giới hạn theo 15 phút. Tài liệu của họ chặn truy cập tự động nên chưa xác nhận được từ xa. Nếu hạn mức dưới 100 credit mỗi ngày thì giảm tần suất cron từ 3 giờ xuống 6 giờ một lần và giảm số chuyên mục.
2. Tạo project Neon, lấy hai connection string cho role ghi và role chỉ đọc.
3. Tạo repo GitHub dưới **tài khoản cá nhân**, không phải organization.

## 11. Quyết định đã chốt

| Quyết định | Lựa chọn | Lý do |
|---|---|---|
| Nguồn tin | NewsData.io | Free tier dùng được cho production, có ảnh và chuyên mục |
| Model | `claude-opus-5` | Chất lượng viết tiếng Việt; chủ site chấp nhận chi phí |
| Nơi chạy worker | GitHub Actions | Vercel Hobby giới hạn cron 1 lần mỗi ngày và function 60 giây |
| Duyệt bài | Không duyệt, đăng tự động | Yêu cầu của chủ site |
| Bài không rút được thân | Bỏ, không đăng | Chặn bịa đặt từ mô tả 150 chữ |
| Lưu nội dung | Bảng riêng theo ngôn ngữ | Truy vấn theo locale không phải chọn cột động |
| Giao diện | Báo nghiêm túc kiểu Reuters/AP | Ưu tiên đọc nhanh, mật độ tin cao |
