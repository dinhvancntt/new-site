import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getArticle, siblingSlug } from '@news/queries';
import { Footer } from '@/components/Footer';
import { Masthead } from '@/components/Masthead';
import { SlugLine } from '@/components/SlugLine';
import { Thumb } from '@/components/Thumb';
import { toParagraphs } from '@/lib/body';
import { getDb } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { otherLang, parseLang, type Lang } from '@/lib/lang';
import { STRINGS, categoryLabel } from '@/lib/site';

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

  const article = await loadArticle(lang, slug);
  if (!article) return {};

  const other = otherLang(lang);
  const otherSlug = await loadSibling(article.articleId, other);

  return {
    title: article.title,
    description: article.summary,
    alternates: {
      canonical: `/${lang}/${slug}`,
      // Hai bản ngôn ngữ của cùng một bài trỏ về nhau.
      languages: {
        [lang]: `/${lang}/${slug}`,
        ...(otherSlug ? { [other]: `/${other}/${otherSlug}` } : {}),
      },
    },
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.summary,
      publishedTime: article.publishedAt.toISOString(),
      ...(article.imageUrl ? { images: [article.imageUrl] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: Params) {
  const { lang: rawLang, slug } = await params;
  const lang = parseLang(rawLang);
  if (!lang) notFound();

  const article = await loadArticle(lang, slug);
  if (!article) notFound();

  const t = STRINGS[lang];
  const other = otherLang(lang);
  const otherSlug = await loadSibling(article.articleId, other);
  const paragraphs = toParagraphs(article.body);

  return (
    <>
      <Masthead
        lang={lang}
        activeCategory={article.category}
        {...(otherSlug ? { otherLangHref: `/${other}/${otherSlug}` } : {})}
      />

      <main className="mx-auto max-w-[1180px] px-5">
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
            alt=""
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
          </div>
        </article>
      </main>

      <Footer lang={lang} />
    </>
  );
}
