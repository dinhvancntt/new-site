import type { MetadataRoute } from 'next';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Tin quốc tế tổng hợp và tóm lược`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION.vi,
    start_url: '/vi',
    display: 'standalone',
    background_color: '#faf9f6',
    theme_color: '#faf9f6',
    lang: 'vi',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
