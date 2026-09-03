import { listLatest } from '@news/queries';
import { buildRssXml } from '@/lib/feed';
import { getDb } from '@/lib/db';
import { LANGS, parseLang } from '@/lib/lang';
import { siteUrl } from '@/lib/site';

export const revalidate = 300;

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }) {
  const lang = parseLang((await params).lang);
  if (!lang) return new Response('Not found', { status: 404 });

  const articles = await listLatest(getDb(), lang, { limit: 50 });

  const xml = buildRssXml({
    siteUrl: siteUrl(),
    lang,
    items: articles.map((article) => ({
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      publishedAt: article.publishedAt,
      imageUrl: article.imageUrl,
    })),
  });

  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
  });
}
