import type { Metadata } from 'next';
import { IBM_Plex_Mono, Source_Serif_4 } from 'next/font/google';
import '../globals.css';
import { LANGS, parseLang } from '@/lib/lang';
import { SITE_NAME, STRINGS, siteUrl } from '@/lib/site';

// Bắt buộc có subset 'vietnamese': subset latin-ext không đủ dấu tiếng Việt,
// thiếu nó thì các chữ như "ế", "ộ" rơi sang font dự phòng và mặt chữ vỡ nhịp.
const serif = Source_Serif_4({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-source-serif',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-plex-mono',
});

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = parseLang((await params).lang) ?? 'vi';

  return {
    metadataBase: new URL(siteUrl()),
    title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
    description: STRINGS[lang].tagline,
    alternates: {
      types: {
        'application/rss+xml': [{ url: `/${lang}/rss.xml`, title: SITE_NAME }],
      },
    },
    openGraph: { siteName: SITE_NAME, type: 'website', locale: lang },
    robots: { index: true, follow: true },
  };
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  // Layout không tự gọi notFound(): trang 404 vẫn cần chính layout này để dựng
  // khung, nên từng page kiểm tra lang rồi mới 404.
  const lang = parseLang((await params).lang) ?? 'vi';

  return (
    <html lang={lang} className={`${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
