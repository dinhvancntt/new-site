'use client';

import { useState } from 'react';
import type { Lang } from '@/lib/lang';
import { STRINGS } from '@/lib/site';

/**
 * Nút chia sẻ: Facebook / X / Telegram mở popup, còn Copy link dùng clipboard.
 * Dùng URL tuyệt đối từ server truyền xuống để crawler và popup ăn canonical.
 */
export function ShareButtons({ lang, url, title }: { lang: Lang; url: string; title: string }) {
  const t = STRINGS[lang];
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const links = [
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { label: 'X', href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
    {
      label: 'Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    },
    { label: 'Zalo', href: `https://zalo.me/share?url=${encodedUrl}` },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API bị chặn (iframe/http): fallback chọn tay qua prompt.
      window.prompt(t.copyLink, url);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <span className="slugline mr-1">{t.share}:</span>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="slugline border border-rule px-3 py-2 text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          {link.label} ↗
        </a>
      ))}
      <button
        type="button"
        onClick={copy}
        className="slugline cursor-pointer border border-rule px-3 py-2 text-ink transition-colors hover:bg-ink hover:text-paper"
      >
        {copied ? t.copied : t.copyLink}
      </button>
    </div>
  );
}
