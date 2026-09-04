import Link from 'next/link';
import type { ArticleCard } from '@news/queries';
import { SlugLine } from './SlugLine';
import { Thumb } from './Thumb';
import type { Lang } from '@/lib/lang';

/** Tin đầu bảng: chiếm hết chiều ngang, cỡ chữ nhảy vọt để mắt bám vào ngay. */
export function LeadStory({ lang, article }: { lang: Lang; article: ArticleCard }) {
  return (
    <article className="border-b border-rule pb-8">
      <Link href={`/${lang}/${article.slug}`} className="group block">
        <div className="grid gap-6 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-7">
            <SlugLine
              lang={lang}
              publishedAt={article.publishedAt}
              sourceName={article.sourceName}
              category={article.category}
            />

            <h2 className="headline link-rule mt-3 text-[length:var(--text-lead)]">
              {article.title}
            </h2>

            <p className="mt-4 max-w-[46ch] text-[1.0625rem] leading-relaxed text-ink-soft">
              {article.summary}
            </p>
          </div>

          <div className="md:col-span-5 md:pt-1">
            <Thumb
              src={article.imageUrl}
              alt={article.title}
              width={960}
              height={640}
              priority
              className="aspect-[3/2]"
            />
          </div>
        </div>
      </Link>
    </article>
  );
}
