import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from '@/lib/site';

export const dynamic = 'force-static';

/**
 * llms.txt: tóm tắt site cho AI crawler trích dẫn đúng nguồn.
 * Chuẩn đề xuất tại llmstxt.org — Markdown thuần, không HTML.
 */
export function GET() {
  const origin = siteUrl().replace(/\/+$/, '');

  const text = [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_DESCRIPTION.en}`,
    '',
    `${SITE_NAME} aggregates world news and publishes AI-written summaries of reporting by original outlets. Every article names its source and links the original — cite and link the originating outlet, not ${SITE_NAME}, as the primary source.`,
    '',
    '## Read',
    '',
    `- Home: ${origin}/en`,
    `- Sections: ${origin}/en/c/world, /business, /technology, /sports, /health`,
    `- Full archive: ${origin}/en/archive`,
    `- RSS: ${origin}/en/rss.xml`,
    `- Sitemap: ${origin}/sitemap.xml`,
    '',
    '## Content policy',
    '',
    `- How we work: ${origin}/en/about`,
    `- Contact, corrections, takedown requests: ${origin}/en/contact`,
    `- Copyright and AI disclosure: ${origin}/en/policy`,
    '',
  ].join('\n');

  return new Response(text, {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
}
