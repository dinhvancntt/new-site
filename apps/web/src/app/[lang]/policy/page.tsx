import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/Footer';
import { Masthead } from '@/components/Masthead';
import { LANGS, parseLang } from '@/lib/lang';
import { SITE_NAME, STRINGS, hreflangAlternates } from '@/lib/site';

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lang = parseLang((await params).lang);
  if (!lang) return {};
  const title = STRINGS[lang].policy;
  const description =
    lang === 'vi'
      ? 'Chính sách của Tin nhanh: nguồn tin, bản quyền, công bố AI, quyền riêng tư.'
      : 'Tin nhanh policy: sources, copyright, AI disclosure, privacy.';
  return {
    title,
    description,
    alternates: { canonical: `/${lang}/policy`, languages: hreflangAlternates('/vi/policy', '/en/policy') },
    openGraph: { type: 'website', url: `/${lang}/policy`, title, description },
  };
}

const VI = [
  `1. Nguồn tin và bản quyền. ${SITE_NAME} không tự sản xuất tin: mọi bài đều viết lại ngắn gọn từ hãng tin gốc, ghi rõ tên hãng và gắn link đọc bản gốc. Chúng tôi tôn trọng bản quyền và gỡ tin theo yêu cầu chính đáng của chủ sở hữu trong 24 giờ.`,
  '2. Công bố AI. Mọi nội dung tóm lược đều do AI thực hiện và có dòng công bố cuối bài. AI có thể diễn đạt chưa chuẩn — độc giả nên đối chiếu bản gốc với tin quan trọng.',
  '3. Sửa sai. Khi nhận báo lỗi có bằng chứng, chúng tôi sửa bài và ghi nhận, hoặc gỡ bài nếu nguồn gốc không còn đáng tin.',
  '4. Quyền riêng tư. Trang không yêu cầu đăng nhập, không bán dữ liệu. Số liệu lượt xem được đo bằng Vercel Analytics và Cloudflare Web Analytics ở dạng ẩn danh.',
];

const EN = [
  `1. Sources and copyright. ${SITE_NAME} produces no original reporting: every story is briefly rewritten from the credited publisher with a link to the original. We respect copyright and honour legitimate takedown requests within 24 hours.`,
  '2. AI disclosure. All summaries are AI-generated and labelled as such. Wording may be imperfect — please check the original for consequential stories.',
  '3. Corrections. Reported errors with evidence are fixed promptly, or the story is removed if the source proves unreliable.',
  '4. Privacy. No login is required and no data is sold. Traffic is measured anonymously with Vercel Analytics and Cloudflare Web Analytics.',
];

export default async function PolicyPage({ params }: Params) {
  const lang = parseLang((await params).lang);
  if (!lang) notFound();
  const paragraphs = lang === 'vi' ? VI : EN;

  return (
    <>
      <Masthead lang={lang} />
      <main className="mx-auto max-w-[1180px] px-5">
        <article className="mx-auto max-w-[46rem] py-8 sm:py-12">
          <h1 className="headline text-[length:var(--text-section)]">{STRINGS[lang].policy}</h1>
          <div className="mt-6 space-y-5 text-[1.0625rem] leading-[1.75]">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </>
  );
}
