import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/Footer';
import { Masthead } from '@/components/Masthead';
import { LANGS, parseLang } from '@/lib/lang';
import { STRINGS, hreflangAlternates, siteUrl } from '@/lib/site';

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

type Params = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lang = parseLang((await params).lang);
  if (!lang) return {};
  const title = STRINGS[lang].contact;
  const description =
    lang === 'vi'
      ? 'Liên hệ với Tin nhanh: báo lỗi bài viết, yêu cầu gỡ tin, hợp tác bản quyền.'
      : 'Contact Tin nhanh: report errors, request takedowns, copyright cooperation.';
  return {
    title,
    description,
    alternates: { canonical: `/${lang}/contact`, languages: hreflangAlternates('/vi/contact', '/en/contact') },
    openGraph: { type: 'website', url: `/${lang}/contact`, title, description },
  };
}

export default async function ContactPage({ params }: Params) {
  const lang = parseLang((await params).lang);
  if (!lang) notFound();
  const origin = siteUrl().replace(/\/+$/, '');
  const email = 'dinhvankiet10021992@gmail.com';

  return (
    <>
      <Masthead lang={lang} />
      <main className="mx-auto max-w-[1180px] px-5">
        <article className="mx-auto max-w-[46rem] py-8 sm:py-12">
          <h1 className="headline text-[length:var(--text-section)]">{STRINGS[lang].contact}</h1>
          <div className="mt-6 space-y-5 text-[1.0625rem] leading-[1.75]">
            {lang === 'vi' ? (
              <>
                <p>
                  Báo lỗi nội dung, yêu cầu sửa hoặc gỡ tin, vấn đề bản quyền: gửi email tới{' '}
                  <a className="link-rule" href={`mailto:${email}`}>
                    {email}
                  </a>
                  . Ghi rõ đường dẫn bài viết (ví dụ {origin}/vi/...) và nội dung cần sửa.
                </p>
                <p>Chúng tôi phản hồi trong 24–48 giờ làm việc và ưu tiên yêu cầu từ hãng tin gốc.</p>
              </>
            ) : (
              <>
                <p>
                  Corrections, takedown requests and copyright issues:{' '}
                  <a className="link-rule" href={`mailto:${email}`}>
                    {email}
                  </a>
                  . Please include the article URL and what needs fixing.
                </p>
                <p>We reply within 24–48 business hours, with priority for original publishers.</p>
              </>
            )}
          </div>
        </article>
      </main>
      <Footer lang={lang} />
    </>
  );
}
