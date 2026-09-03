import postgres from 'postgres';

const sql = postgres(process.env['DATABASE_URL']!, { ssl: 'require' });

async function main() {
  const rows = await sql`
    select c.slug, a.category, c.lang, c.title, c.summary, length(c.body) as body_len
    from articles a join article_contents c on c.article_id = a.id
    order by a.published_at desc, c.lang limit 8`;
  for (const r of rows) {
    console.log(`[${r['lang']}|${r['category']}|${r['body_len']}b] ${String(r['title']).slice(0, 65)}`);
  }
  const totals = await sql`
    select (select count(*)::int from articles) as articles,
           (select count(*)::int from article_contents) as contents,
           (select count(*)::int from article_contents where lang='vi') as vi,
           (select count(*)::int from article_contents where lang='en') as en`;
  console.log('\ntotals:', JSON.stringify(totals[0]));
  const runs = await sql`select id, started_at, finished_at, fetched, written, failed from ingest_runs order by started_at desc limit 3`;
  for (const r of runs) console.log('run:', JSON.stringify(r));
  await sql.end();
}

main();
