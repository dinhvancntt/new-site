import { buildRobotsTxt } from '@/lib/robots';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-static';

export function GET() {
  return new Response(buildRobotsTxt(siteUrl()), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
