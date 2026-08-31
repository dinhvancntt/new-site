import { imageUrl } from '@/lib/image';

/**
 * Ảnh remote đi qua wsrv.nl chứ không qua next/image: host nguồn là bất kỳ nên
 * không lập được allowlist, và Vercel Hobby chỉ bao 5K transformation mỗi tháng.
 * Xem lý do đầy đủ trong src/lib/image.ts.
 */
export function Thumb({
  src,
  alt,
  width,
  height,
  priority = false,
  className = '',
}: {
  src: string | null;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}) {
  const url = imageUrl(src, { width, height });
  if (!url) return null;

  return (
    <img
      src={url}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={`w-full bg-paper-sunk object-cover ${className}`}
    />
  );
}
