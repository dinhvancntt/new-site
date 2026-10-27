import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getArticle, listByCategory, siblingSlug } from '@news/queries';
import { Footer } from '@/components/Footer';
import { Masthead } from '@/components/Masthead';
import { River } from '@/components/River';
import { ShareButtons } from '@/components/ShareButtons';
import { SlugLine } from '@/components/SlugLine';
import { Thumb } from '@/components/Thumb';
import { toParagraphs } from '@/lib/body';
import { getDb } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { imageUrl } from '@/lib/image';
import {
  DEFAULT_LANG,
  isRetiredLang,
  switchableLang,
  parseLang,
  retiredArticleTarget,
  type Lang,
} from '@/lib/lang';
import { SITE_NAME, STRINGS, categoryLabel, siteUrl } from '@/lib/site';

// Bài đã đăng thì nội dung cố định, nên cache vĩnh viễn. Không dựng sẵn bài nào
// lúc build — trang sinh ở lần truy cập đầu rồi nằm luôn trong cache.
export const revalidate = false;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

type Params = { params: Promise<{ lang: string; slug: string }> };

const loadArticle = cache((lang: Lang, slug: string) => getArticle(getDb(), lang, slug));
const loadSibling = cache((articleId: string, lang: Lang) => siblingSlug(getDb(), articleId, lang));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang: rawLang, slug } = await params;
  const lang = parseLang(rawLang);
  if (!lang) return {};
  // Ngôn ngữ đã ngừng thì trang luôn 308, metadata không bao giờ được dùng tới.
  if (isRetiredLang(lang)) return {};

  const article = await loadArticle(lang, slug);
  if (!article) return {};

  const description = article.summary.length > 160 ? `${article.summary.slice(0, 157)}…` : article.summary;
  const ogImage = imageUrl(article.imageUrl, { width: 1200, height: 630 });
  const label = categoryLabel(lang, article.category);

  return {
    title: article.title,
    description,
    authors: [{ name: article.sourceName }],
    alternates: { canonical: `/${lang}/${slug}` },
    openGraph: {
      type: 'article',
      url: `/${lang}/${slug}`,
      title: article.title,
      description,
      publishedTime: article.publishedAt.toISOString(),
      modifiedTime: article.publishedAt.toISOString(),
      section: label,
      authors: [article.sourceName],
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: article.title }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: Params) {
  const { lang: rawLang, slug } = await params;
  const lang = parseLang(rawLang);
  if (!lang) notFound();

  // Tiếng Việt đã ngừng: slug hai ngôn ngữ khác nhau nên phải tra bản tiếng Anh
  // cùng `article_id` rồi 308 sang đó, thay vì ghép chuỗi ở tầng next.config.
  if (isRetiredLang(lang)) {
    const retired = await loadArticle(lang, slug);
    const target = retired
      ? retiredArticleTarget(await loadSibling(retired.articleId, DEFAULT_LANG))
      : null;
    if (!target) notFound();
    permanentRedirect(target);
  }

  const article = await loadArticle(lang, slug);
  if (!article) notFound();

  const t = STRINGS[lang];
  // Chỉ tra bài song ngữ khi ngôn ngữ kia còn xuất bản; nếu không, nút chuyển
  // sẽ trỏ vào URL 308 ngay từ trong thân trang.
  const other = switchableLang(lang);
  const otherSlug = other ? await loadSibling(article.articleId, other) : null;
  const paragraphs = toParagraphs(article.body);
  const origin = siteUrl().replace(/\/+$/, '');
  const label = categoryLabel(lang, article.category);
  const pageUrl = `${origin}/${lang}/${slug}`;
  // Tin liên quan: cùng chuyên mục, trừ bài đang đọc. Lấy dư 1 để bù bài bị loại.
  const related = (await listByCategory(getDb(), lang, article.category, { limit: 7 }))
    .filter((item) => item.slug !== slug)
    .slice(0, 6);
  const thumb = imageUrl(article.imageUrl, { width: 1200, height: 675 });
  const newsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.summary,
    ...(thumb ? { image: [thumb] } : {}),
    datePublished: article.publishedAt.toISOString(),
    dateModified: article.publishedAt.toISOString(),
    inLanguage: lang,
    articleSection: label,
    author: [{ '@type': 'Organization', name: article.sourceName, url: article.sourceUrl }],
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: origin,
      logo: { '@type': 'ImageObject', url: `${origin}/icon.svg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${origin}/${lang}/${slug}` },
    isAccessibleForFree: true,
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${origin}/${lang}` },
      { '@type': 'ListItem', position: 2, name: label, item: `${origin}/${lang}/c/${article.category}` },
      { '@type': 'ListItem', position: 3, name: article.title, item: `${origin}/${lang}/${slug}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(newsJsonLd) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Masthead
        lang={lang}
        activeCategory={article.category}
        {...(other && otherSlug ? { otherLangHref: `/${other}/${otherSlug}` } : {})}
      />

      <main className="mx-auto max-w-[1180px] px-5">
        <nav aria-label="Breadcrumb" className="slugline flex flex-wrap items-center gap-x-2 gap-y-1 pt-6">
          <Link href={`/${lang}`} className="link-rule">
            {SITE_NAME}
          </Link>
          <span aria-hidden className="text-rule-strong">
            /
          </span>
          <Link href={`/${lang}/c/${article.category}`} className="link-rule">
            {label}
          </Link>
          <span aria-hidden className="text-rule-strong">
            /
          </span>
          <span aria-current="page" className="max-w-[40ch] truncate text-ink-soft">
            {article.title}
          </span>
        </nav>

        <article className="mx-auto max-w-[46rem] py-8 sm:py-12">
          <SlugLine
            lang={lang}
            publishedAt={article.publishedAt}
            sourceName={article.sourceName}
            category={article.category}
          />

          <h1 className="headline mt-4 text-[length:var(--text-section)]">{article.title}</h1>

          <p className="mt-5 border-l-2 border-rule-strong pl-4 text-[1.125rem] leading-relaxed text-ink-soft">
            {article.summary}
          </p>

          <Thumb
            src={article.imageUrl}
            alt={article.title}
            width={1200}
            height={675}
            priority
            className="mt-8 aspect-[16/9]"
          />

          {/* Công bố bắt buộc: người đọc phải biết bài này do máy viết lại. */}
          <p className="slugline mt-8 border-l-2 border-wire py-1 pl-3 normal-case tracking-normal">
            {t.aiNotice(article.sourceName)}
          </p>

          <div className="mt-8 space-y-5 text-[1.0625rem] leading-[1.75]">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          <div className="mt-10 border-t border-rule pt-6">
            <p className="slugline">
              {categoryLabel(lang, article.category)} · {article.sourceName} · {t.publishedAt}{' '}
              {formatDateTime(article.publishedAt, lang)}
            </p>

            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="slugline mt-4 inline-block border border-ink px-4 py-2.5 text-ink transition-colors hover:bg-ink hover:text-paper"
            >
              {t.readOriginal} ↗
            </a>

            <ShareButtons lang={lang} url={pageUrl} title={article.title} />
          </div>
        </article>

        {related.length > 0 ? (
          <section className="mx-auto max-w-[1180px] border-t-2 border-ink py-8">
            <h2 className="slugline mb-5 border-b-2 border-ink pb-2 text-ink">{t.related}</h2>
            <River lang={lang} articles={related} thumbsFor={3} />
          </section>
        ) : null}
      </main>

      <Footer lang={lang} />
    </>
  );
}
