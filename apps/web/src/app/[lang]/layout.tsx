import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import { IBM_Plex_Mono, Source_Serif_4 } from 'next/font/google';
import '../globals.css';
import { cfBeacon } from '@/lib/beacon';
import { LANGS, parseLang } from '@/lib/lang';
import { OG_LOCALE, SITE_DESCRIPTION, SITE_NAME, hreflangAlternates, siteUrl } from '@/lib/site';

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
  const gscVerification = process.env['GSC_VERIFICATION'];
  const description = SITE_DESCRIPTION[lang];
  const title = lang === 'vi' ? `${SITE_NAME} — Tin quốc tế tổng hợp và tóm lược 24/7` : `${SITE_NAME} — World news gathered and summarised 24/7`;

  return {
    metadataBase: new URL(siteUrl()),
    title: { default: title, template: `%s — ${SITE_NAME}` },
    description,
    keywords:
      lang === 'vi'
        ? ['tin nhanh', 'tin thế giới', 'tin kinh doanh', 'tin công nghệ', 'tin thể thao', 'tin sức khỏe']
        : ['breaking news', 'world news', 'business', 'technology', 'sports', 'health'],
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    category: 'news',
    alternates: {
      // Canonical mặc định cho trang chủ từng ngôn ngữ; các page con ghi đè.
      canonical: `/${lang}`,
      languages: hreflangAlternates('/vi', '/en'),
      types: {
        'application/rss+xml': [{ url: `/${lang}/rss.xml`, title: SITE_NAME }],
      },
    },
    openGraph: {
      siteName: SITE_NAME,
      type: 'website',
      locale: OG_LOCALE[lang],
      alternateLocale: [OG_LOCALE[lang === 'vi' ? 'en' : 'vi']],
      url: `/${lang}`,
      title,
      description,
      images: [
        {
          url: `/${lang}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/${lang}/opengraph-image`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    // Thẻ verify Search Console: chỉ xuất hiện khi đã đặt biến, để trống thì không render.
    ...(gscVerification ? { verification: { google: gscVerification } } : {}),
  };
}

export const viewport = { themeColor: '#faf9f6' };

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
  const beacon = cfBeacon(process.env['CF_BEACON_TOKEN']);
  const origin = siteUrl().replace(/\/+$/, '');
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${origin}/${lang}`,
    inLanguage: [OG_LOCALE[lang]],
  };

  return (
    <html lang={lang} className={`${serif.variable} ${mono.variable}`}>
      <body>
        {/* Rút ngắn bắt tay tới CDN ảnh và Google Fonts trước khi trình duyệt cần tới. */}
        <link rel="preconnect" href="https://wsrv.nl" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Cho phép tìm tin trực tiếp từ thanh tìm kiếm của trình duyệt. */}
        <link rel="search" type="application/opensearchdescription+xml" title={SITE_NAME} href="/opensearch.xml" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        {children}
        <Analytics />
        <SpeedInsights />
        {/* Cloudflare Web Analytics: giữ số liệu dài hạn, bù retention 1 tháng của Vercel. */}
        {beacon ? (
          <script type="module" src={beacon.src} data-cf-beacon={beacon.data} />
        ) : null}
      </body>
    </html>
  );
}
