import type { MetadataRoute } from 'next';
import { DEFAULT_LANG } from '@/lib/lang';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — World news gathered and summarised`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION[DEFAULT_LANG],
    start_url: `/${DEFAULT_LANG}`,
    display: 'standalone',
    background_color: '#faf9f6',
    theme_color: '#faf9f6',
    lang: DEFAULT_LANG,
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
