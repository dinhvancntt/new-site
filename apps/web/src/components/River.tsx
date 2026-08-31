import type { ArticleCard } from '@news/queries';
import { ArticleItem } from './ArticleItem';
import type { Lang } from '@/lib/lang';

/**
 * Dòng sông tin. Dùng CSS multi-column chứ không phải grid: chữ chảy từ đỉnh
 * cột này sang cột kia đúng như cột báo, và `column-rule` cho đường kẻ dọc thật
 * giữa các cột thay vì phải kẻ giả bằng border.
 */
export function River({
  lang,
  articles,
  thumbsFor = 0,
  showCategory = true,
}: {
  lang: Lang;
  articles: readonly ArticleCard[];
  /** Vài mẩu đầu có ảnh để tạo nhịp; còn lại thuần chữ cho dày tin. */
  thumbsFor?: number;
  showCategory?: boolean;
}) {
  return (
    <div className="columns-1 gap-8 [column-rule:1px_solid_var(--color-rule)] sm:columns-2 lg:columns-3">
      {articles.map((article, index) => (
        <ArticleItem
          key={`${article.slug}-${index}`}
          lang={lang}
          article={article}
          withThumb={index < thumbsFor}
          showCategory={showCategory}
        />
      ))}
    </div>
  );
}
