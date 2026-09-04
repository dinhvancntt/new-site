import { SITE_NAME, siteUrl } from '@/lib/site';

export const dynamic = 'force-static';

/** Mô tả tìm kiếm cho trình duyệt (Firefox/Edge): gõ từ khóa ngay từ thanh địa chỉ. */
export function GET() {
  const origin = siteUrl().replace(/\/+$/, '');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">',
    `  <ShortName>${SITE_NAME}</ShortName>`,
    `  <Description>Tìm tin trên ${SITE_NAME}</Description>`,
    '  <InputEncoding>UTF-8</InputEncoding>',
    `  <Url type="text/html" template="${origin}/vi/search?q={searchTerms}"/>`,
    `  <Url type="text/html" template="${origin}/en/search?q={searchTerms}"/>`,
    '</OpenSearchDescription>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: { 'content-type': 'application/opensearchdescription+xml; charset=utf-8' },
  });
}
