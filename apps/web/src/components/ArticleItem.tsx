import Link from 'next/link';
import type { ArticleCard } from '@news/queries';
import { SlugLine } from './SlugLine';
import { Thumb } from './Thumb';
import type { Lang } from '@/lib/lang';

/** Một mẩu tin: slug line, tiêu đề, tóm tắt cắt gọn, kẻ chỉ ngăn cách bên dưới. */
export function ArticleItem({
  lang,
  article,
  withThumb = false,
  showCategory = true,
}: {
  lang: Lang;
  article: ArticleCard;
  withThumb?: boolean;
  showCategory?: boolean;
}) {
  return (
    <article className="mb-5 break-inside-avoid border-b border-rule pb-5">
      <Link href={`/${lang}/${article.slug}`} className="block">
        {withThumb ? (
          <Thumb
            src={article.imageUrl}
            alt=""
            width={480}
            height={270}
            className="mb-3 aspect-[16/9]"
          />
        ) : null}

        <SlugLine
          lang={lang}
          publishedAt={article.publishedAt}
          sourceName={article.sourceName}
          {...(showCategory ? { category: article.category } : {})}
        />

        <h3 className="headline link-rule mt-2 text-[1.0625rem] sm:text-[1.125rem]">
          {article.title}
        </h3>

        <p className="clamp-2 mt-1.5 text-[0.9375rem] leading-snug text-ink-soft">
          {article.summary}
        </p>
      </Link>
    </article>
  );
}
