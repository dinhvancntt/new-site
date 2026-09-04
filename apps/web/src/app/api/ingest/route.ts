import type { NextRequest } from 'next/server';
import { triggerIngest } from '@/lib/ingest-trigger';

// Query string quyết định hành vi nên không được cache.
export const dynamic = 'force-dynamic';

/**
 * GET /api/ingest?secret=... → kích workflow ingest trên GitHub Actions.
 * Dùng cho cron-job.org hẹn giờ và bấm tay khi có tin nóng.
 */
export async function GET(request: NextRequest) {
  const { status, body } = await triggerIngest(request.url, {
    INGEST_SECRET: process.env['INGEST_SECRET'],
    GITHUB_TOKEN: process.env['GITHUB_TOKEN'],
    GITHUB_REPO: process.env['GITHUB_REPO'],
    GITHUB_REF: process.env['GITHUB_REF'],
  });
  return Response.json(body, { status });
}
