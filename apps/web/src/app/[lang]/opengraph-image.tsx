import { ImageResponse } from 'next/og';
import { LANGS, parseLang } from '@/lib/lang';
import { SITE_NAME } from '@/lib/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export default async function OpengraphImage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = parseLang((await params).lang) ?? 'vi';
  const tagline =
    lang === 'vi' ? 'Tin quoc te — tong hop va tom luoc 24/7' : 'World news — gathered and summarised 24/7';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#faf9f6',
          borderTop: '24px solid #c8402a',
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 700, fontFamily: 'Georgia, serif' }}>{SITE_NAME}</div>
        <div style={{ marginTop: 16, fontSize: 44, fontFamily: 'Arial, sans-serif', color: '#555' }}>
          {tagline}
        </div>
      </div>
    ),
    { ...size },
  );
}
