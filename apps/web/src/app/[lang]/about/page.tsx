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
  const title = STRINGS[lang].about;
  const description =
    lang === 'vi'
      ? `${SITE_NAME}: tin quốc tế được tổng hợp và tóm lược tự động bằng AI từ các hãng tin, cập nhật liên tục.`
      : `${SITE_NAME}: world news gathered and summarised automatically by AI from wire services.`;
  return {
    title,
    description,
    alternates: { canonical: `/${lang}/about`, languages: hreflangAlternates('/vi/about', '/en/about') },
    openGraph: { type: 'website', url: `/${lang}/about`, title, description },
  };
}

const BODY_VI = [
  `${SITE_NAME} là trang tổng hợp tin quốc tế, tóm lược tự động bằng AI từ các hãng tin lớn để bạn đọc nắm tin nhanh trong 1 phút.`,
  'Cách làm việc: hệ thống thu thập bài gốc từ các hãng tin, chọn tin đáng chú ý theo 5 mục Thế giới, Kinh doanh, Công nghệ, Thể thao, Sức khoẻ, sau đó viết lại ngắn gọn và luôn gắn link đọc bản gốc cùng tên hãng tin.',
  'Lưu ý quan trọng: nội dung do AI tóm lược nên có thể thiếu ngữ cảnh. Với tin quan trọng, hãy bấm Đọc bản gốc để kiểm chứng. Nếu phát hiện sai sót, báo cho chúng tôi qua trang Liên hệ để sửa trong 24 giờ.',
];

const BODY_EN = [
  `${SITE_NAME} gathers world news from major wires and summarises it automatically with AI so you can catch up in one minute.`,
  'How it works: the pipeline collects original articles across World, Business, Technology, Sports and Health, rewrites them briefly, and always links and credits the original publisher.',
  'Please note: AI summaries can miss context. For important stories, always open the original. Report mistakes via the Contact page and we will fix them within 24 hours.',
];

export default async function AboutPage({ params }: Params) {
  const lang = parseLang((await params).lang);
  if (!lang) notFound();
  const paragraphs = lang === 'vi' ? BODY_VI : BODY_EN;

  return (
    <>
      <Masthead lang={lang} />
      <main className="mx-auto max-w-[1180px] px-5">
        <article className="mx-auto max-w-[46rem] py-8 sm:py-12">
          <h1 className="headline text-[length:var(--text-section)]">{STRINGS[lang].about}</h1>
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
