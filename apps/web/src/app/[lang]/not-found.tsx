import Link from 'next/link';
import { LANGS } from '@/lib/lang';
import { SITE_NAME, STRINGS } from '@/lib/site';

/**
 * not-found không nhận được `params`, nên không thể biết người đọc đang ở bản
 * ngôn ngữ nào. Đoán sai thì một nửa số người đọc gặp trang lạ ngôn ngữ, vì vậy
 * trả lời bằng cả hai — đúng tinh thần một site song ngữ.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1180px] flex-col justify-center px-5 py-20">
      <p className="slugline text-wire">404</p>

      <div className="mt-6 border-t-2 border-ink">
        {LANGS.map((lang) => {
          const t = STRINGS[lang];
          return (
            <section key={lang} className="border-b border-rule py-7">
              <h1 className="headline text-[length:var(--text-section)]">{t.notFoundTitle}</h1>
              <p className="mt-2 max-w-[52ch] text-ink-soft">{t.notFoundBody}</p>
              <p className="slugline mt-4">
                <Link href={`/${lang}`} className="link-rule text-ink">
                  ← {t.backHome}
                </Link>
              </p>
            </section>
          );
        })}
      </div>

      <p className="slugline mt-8">{SITE_NAME}</p>
    </main>
  );
}
