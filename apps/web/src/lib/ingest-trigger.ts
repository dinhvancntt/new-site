import { timingSafeEqual } from 'node:crypto';

export type TriggerEnv = {
  INGEST_SECRET?: string;
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string;
  GITHUB_REF?: string;
};

export type TriggerResult = { status: number; body: Record<string, unknown> };

/** So sánh secret chống timing-attack; độ dài khác nhau trả false ngay. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/**
 * Kích workflow ingest trên GitHub Actions qua workflow_dispatch.
 * Việc nặng (tải tin, viết lại, ghi DB) vẫn chạy bên GitHub — hàm này chỉ
 * gọi API và trả về ngay nên không chạm timeout của serverless.
 */
export async function triggerIngest(requestUrl: string, env: TriggerEnv): Promise<TriggerResult> {
  const secret = new URL(requestUrl).searchParams.get('secret') ?? '';

  if (!env.INGEST_SECRET || !secretMatches(secret, env.INGEST_SECRET)) {
    return { status: 401, body: { ok: false, error: 'unauthorized' } };
  }
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    return { status: 500, body: { ok: false, error: 'server not configured' } };
  }

  const ref = env.GITHUB_REF ?? 'main';
  const dispatchUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/ingest.yml/dispatches`;

  const res = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref }),
  });

  if (res.status !== 204) {
    const detail = (await res.text()).slice(0, 200);
    return { status: 502, body: { ok: false, error: `github rejected dispatch (${res.status})`, detail } };
  }
  return { status: 200, body: { ok: true, ref } };
}
