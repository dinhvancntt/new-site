import { formatTime } from '@/lib/format';
import type { Lang } from '@/lib/lang';
import { categoryLabel } from '@/lib/site';

/**
 * Điểm nhận dạng của site: dòng micro-type mono đặt trên mỗi tiêu đề, đọc như
 * đầu bản tin điện báo — GIỜ · NGUỒN · CHUYÊN MỤC.
 */
export function SlugLine({
  lang,
  publishedAt,
  sourceName,
  category,
}: {
  lang: Lang;
  publishedAt: Date;
  sourceName: string;
  category?: string;
}) {
  return (
    <p className="slugline flex flex-wrap items-center gap-x-2 gap-y-1">
      <time dateTime={publishedAt.toISOString()} className="text-ink tabular-nums">
        {formatTime(publishedAt)}
      </time>
      <span aria-hidden className="text-rule-strong">
        ·
      </span>
      <span>{sourceName}</span>
      {category ? (
        <>
          <span aria-hidden className="text-rule-strong">
            ·
          </span>
          <span>{categoryLabel(lang, category)}</span>
        </>
      ) : null}
    </p>
  );
}
