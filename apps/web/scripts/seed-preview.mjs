/**
 * Dữ liệu mẫu để xem giao diện mà không phải chạy worker (đỡ tốn credit API).
 * CHỈ dùng khi phát triển. Mọi hàng seed đều mang source_id tiền tố `preview:`
 * nên xoá sạch được, không lẫn với tin thật.
 *
 *   node apps/web/scripts/seed-preview.mjs          # nạp
 *   node apps/web/scripts/seed-preview.mjs --clear  # xoá sạch
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import postgres from 'postgres';

const PREFIX = 'preview:';

for (const line of readFileSync(new URL('../../../.env', import.meta.url), 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq > 0) process.env[trimmed.slice(0, eq).trim()] ??= trimmed.slice(eq + 1).trim();
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const removeDiacritics = (value) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

const STORIES = [
  {
    category: 'world',
    source: 'Reuters',
    image: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1600',
    vi: {
      title: 'Liên minh châu Âu chốt gói viện trợ khẩn cấp cho vùng chịu hạn',
      summary:
        'Khoản chi được thông qua sau hai ngày họp kín, tập trung vào nước sạch và lương thực.',
    },
    en: {
      title: 'European Union agrees emergency aid package for drought-hit regions',
      summary: 'The package passed after two days of closed talks, focused on water and food.',
    },
  },
  {
    category: 'business',
    source: 'Bloomberg',
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600',
    vi: {
      title: 'Ngân hàng trung ương giữ nguyên lãi suất, phát tín hiệu chờ thêm số liệu',
      summary: 'Quyết định đúng như dự báo của thị trường; đồng nội tệ gần như không biến động.',
    },
    en: {
      title: 'Central bank holds rates steady, signalling a wait for more data',
      summary: 'The decision matched market expectations and the currency barely moved.',
    },
  },
  {
    category: 'technology',
    source: 'The Verge',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600',
    vi: {
      title: 'Hãng chip công bố dây chuyền mới, cam kết giao hàng từ quý sau',
      summary: 'Nhà máy đặt tại châu Á, dự kiến tuyển thêm khoảng hai nghìn kỹ sư.',
    },
    en: {
      title: 'Chipmaker unveils new production line with deliveries promised next quarter',
      summary: 'The plant sits in Asia and is expected to add about two thousand engineers.',
    },
  },
  {
    category: 'sports',
    source: 'AP',
    image: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=1600',
    vi: {
      title: 'Đội tuyển giành vé vào vòng trong sau trận hoà không bàn thắng',
      summary: 'Kết quả đủ để đứng nhì bảng nhờ hơn hiệu số trong lần chạm trán trực tiếp.',
    },
    en: {
      title: 'National side reaches the next round after a goalless draw',
      summary: 'The point was enough for second place on the head-to-head tiebreak.',
    },
  },
  {
    category: 'health',
    source: 'BBC News',
    image: 'https://images.unsplash.com/photo-1584982751601-97dcc096659c?w=1600',
    vi: {
      title: 'Cơ quan y tế khuyến cáo tiêm nhắc trước mùa lạnh',
      summary: 'Khuyến cáo áp dụng cho người trên sáu mươi lăm tuổi và nhóm có bệnh nền.',
    },
    en: {
      title: 'Health agency recommends booster shots before the cold season',
      summary: 'The advice covers people over sixty-five and those with existing conditions.',
    },
  },
  {
    category: 'world',
    source: 'Reuters',
    image: null,
    vi: {
      title: 'Hai nước nối lại đàm phán biên giới sau sáu tháng gián đoạn',
      summary: 'Vòng đàm phán diễn ra tại nước thứ ba, chưa có thời hạn kết thúc.',
    },
    en: {
      title: 'Two countries resume border talks after a six-month pause',
      summary: 'The round is being held in a third country with no deadline set.',
    },
  },
  {
    category: 'business',
    source: 'Financial Times',
    image: null,
    vi: {
      title: 'Giá vận tải biển giảm tháng thứ tư liên tiếp',
      summary: 'Lượng đơn hàng mùa cao điểm thấp hơn cùng kỳ năm ngoái.',
    },
    en: {
      title: 'Shipping rates fall for a fourth consecutive month',
      summary: 'Peak-season bookings came in below the same period last year.',
    },
  },
  {
    category: 'technology',
    source: 'Reuters',
    image: null,
    vi: {
      title: 'Cơ quan quản lý mở rà soát với dịch vụ lưu trữ đám mây',
      summary: 'Trọng tâm là điều khoản khoá chân khách hàng và phí chuyển dữ liệu ra ngoài.',
    },
    en: {
      title: 'Regulator opens a review into cloud storage services',
      summary: 'It centres on lock-in terms and the cost of moving data out.',
    },
  },
  {
    category: 'world',
    source: 'AP',
    image: null,
    vi: {
      title: 'Bão đổ bộ vào bờ biển phía đông, hàng nghìn hộ mất điện',
      summary: 'Lực lượng cứu hộ đã sơ tán các khu vực trũng thấp từ đêm qua.',
    },
    en: {
      title: 'Storm makes landfall on the east coast, cutting power to thousands',
      summary: 'Rescue teams evacuated low-lying areas overnight.',
    },
  },
  {
    category: 'health',
    source: 'The Guardian',
    image: null,
    vi: {
      title: 'Nghiên cứu ghi nhận số ca mắc giảm ở nhóm trẻ đi học',
      summary: 'Số liệu lấy từ mười hai bệnh viện trong vòng một năm.',
    },
    en: {
      title: 'Study records fewer cases among school-age children',
      summary: 'The data covers twelve hospitals over one year.',
    },
  },
  {
    category: 'sports',
    source: 'Reuters',
    image: null,
    vi: {
      title: 'Giải vô địch dời địa điểm thi đấu vì sân chưa kịp sửa',
      summary: 'Ban tổ chức thông báo trước bốn tuần, vé đã bán được hoàn tiền.',
    },
    en: {
      title: 'Championship moves venue as stadium repairs run late',
      summary: 'Organisers gave four weeks notice and tickets will be refunded.',
    },
  },
  {
    category: 'business',
    source: 'Bloomberg',
    image: null,
    vi: {
      title: 'Hãng hàng không đặt thêm máy bay thân hẹp cho đường bay khu vực',
      summary: 'Hợp đồng gồm quyền chọn mua thêm, giao hàng rải trong bốn năm.',
    },
    en: {
      title: 'Airline orders more narrow-body jets for regional routes',
      summary: 'The deal includes purchase options with deliveries across four years.',
    },
  },
  {
    category: 'technology',
    source: 'BBC News',
    image: null,
    vi: {
      title: 'Tuyến cáp quang biển mới đi vào hoạt động',
      summary: 'Tuyến cáp nối ba quốc gia, tổng chiều dài hơn bốn nghìn ki-lô-mét.',
    },
    en: {
      title: 'New undersea fibre-optic cable enters service',
      summary: 'It links three countries across more than four thousand kilometres.',
    },
  },
  {
    category: 'world',
    source: 'The Guardian',
    image: null,
    vi: {
      title: 'Thành phố thí điểm hạn chế xe cá nhân vào trung tâm',
      summary: 'Chương trình kéo dài sáu tháng, áp dụng trong giờ cao điểm.',
    },
    en: {
      title: 'City pilots limits on private cars in the centre',
      summary: 'The six-month scheme applies during peak hours only.',
    },
  },
];

function body(lead, lang) {
  const vi = [
    `${lead} Thông tin được công bố trong thông cáo phát đi cuối ngày.`,
    'Các bên liên quan cho biết sẽ tiếp tục trao đổi trong những tuần tới, song chưa đưa ra mốc thời gian cụ thể nào.',
    'Số liệu kèm theo thông cáo cho thấy mức thay đổi so với cùng kỳ năm trước, nhưng không nêu chi tiết theo từng khu vực.',
    'Đại diện cơ quan chức năng từ chối bình luận thêm ngoài nội dung đã công bố.',
  ];
  const en = [
    `${lead} The details came in a statement issued late in the day.`,
    'Those involved said talks would continue in the coming weeks, without giving a timetable.',
    'Figures attached to the statement showed the change against the same period last year, but were not broken down by region.',
    'Officials declined to comment beyond the published statement.',
  ];
  return (lang === 'vi' ? vi : en).join('\n\n');
}

function slugify(input) {
  return removeDiacritics(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

if (process.argv.includes('--clear')) {
  const deleted = await sql`delete from articles where source_id like ${PREFIX + '%'} returning id`;
  console.log(`Đã xoá ${deleted.length} bài preview.`);
  await sql.end();
  process.exit(0);
}

const now = Date.now();
let inserted = 0;

for (const [index, story] of STORIES.entries()) {
  const sourceId = `${PREFIX}${index}`;
  const publishedAt = new Date(now - index * 47 * 60 * 1000);
  const titleHash = createHash('sha256').update(sourceId).digest('hex');

  const [article] = await sql`
    insert into articles (source_id, title_hash, source_name, source_url, image_url, category, published_at, model)
    values (${sourceId}, ${titleHash}, ${story.source}, ${'https://example.com/' + index},
            ${story.image}, ${story.category}, ${publishedAt}, ${'preview'})
    on conflict (source_id) do nothing
    returning id`;

  if (!article) continue;

  for (const lang of ['vi', 'en']) {
    const content = story[lang];
    await sql`
      insert into article_contents (article_id, lang, slug, title, summary, body, search_text)
      values (${article.id}, ${lang}, ${slugify(content.title)}, ${content.title},
              ${content.summary}, ${body(content.summary, lang)},
              ${removeDiacritics(`${content.title} ${content.summary}`)})`;
  }
  inserted += 1;
}

console.log(`Đã nạp ${inserted} bài preview (mỗi bài 2 ngôn ngữ).`);
await sql.end();
