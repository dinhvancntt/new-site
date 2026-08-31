import type { MetadataRoute } from 'next';
import { listLatest } from '@news/queries';
import { getDb } from '@/lib/db';
import { LANGS } from '@/lib/lang';
import { CATEGORIES, siteUrl } from '@/lib/site';

export const revalidate = 300;

/** Sitemap gộp cả hai ngôn ngữ, theo đúng thiết kế. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteUrl();
  const db = getDb();

  const entries: MetadataRoute.Sitemap = [];

  for (const lang of LANGS) {
    entries.push({ url: `${origin}/${lang}`, changeFrequency: 'hourly', priority: 1 });

    for (const category of CATEGORIES) {
      entries.push({
        url: `${origin}/${lang}/c/${category}`,
        changeFrequency: 'hourly',
        priority: 0.7,
      });
    }

    const articles = await listLatest(db, lang, { limit: 2000 });
    for (const article of articles) {
      entries.push({
        url: `${origin}/${lang}/${article.slug}`,
        lastModified: article.publishedAt,
        priority: 0.5,
      });
    }
  }

  return entries;
}
