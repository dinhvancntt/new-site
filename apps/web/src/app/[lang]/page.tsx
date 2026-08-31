import { notFound } from 'next/navigation';
import { listLatest } from '@news/queries';
import { Footer } from '@/components/Footer';
import { LeadStory } from '@/components/LeadStory';
import { Masthead } from '@/components/Masthead';
import { River } from '@/components/River';
import { getDb } from '@/lib/db';
import { LANGS, parseLang } from '@/lib/lang';
import { STRINGS } from '@/lib/site';

export const revalidate = 300;

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = parseLang((await params).lang);
  if (!lang) notFound();

  const t = STRINGS[lang];
  const articles = await listLatest(getDb(), lang, { limit: 25 });
  const [lead, ...rest] = articles;

  return (
    <>
      <Masthead lang={lang} />

      <main className="mx-auto max-w-[1180px] px-5">
        {lead ? (
          <>
            <div className="py-8">
              <LeadStory lang={lang} article={lead} />
            </div>

            <h2 className="slugline mb-5 border-b-2 border-ink pb-2 text-ink">{t.latest}</h2>

            <River lang={lang} articles={rest} thumbsFor={3} />
          </>
        ) : (
          <p className="py-24 text-center text-ink-soft">{t.noArticles}</p>
        )}
      </main>

      <Footer lang={lang} />
    </>
  );
}
