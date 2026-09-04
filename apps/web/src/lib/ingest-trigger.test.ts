import { afterEach, describe, expect, test, vi } from 'vitest';
import { triggerIngest, type TriggerEnv } from './ingest-trigger';

const env: TriggerEnv = {
  INGEST_SECRET: 's3cret',
  GITHUB_TOKEN: 'ghp_test',
  GITHUB_REPO: 'owner/news-site',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('triggerIngest', () => {
  test('sai secret thì 401 và không gọi GitHub', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await triggerIngest('https://x/api/ingest?secret=sai', env);

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('thiếu secret cũng 401', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const res = await triggerIngest('https://x/api/ingest', env);
    expect(res.status).toBe(401);
  });

  test('thiếu cấu hình server thì 500', async () => {
    const res = await triggerIngest('https://x/api/ingest?secret=s3cret', { INGEST_SECRET: 's3cret' });
    expect(res.status).toBe(500);
  });

  test('đúng secret thì gọi workflow_dispatch và trả 200', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await triggerIngest('https://x/api/ingest?secret=s3cret', env);

    expect(res).toEqual({ status: 200, body: { ok: true, ref: 'main' } });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      'https://api.github.com/repos/owner/news-site/actions/workflows/ingest.yml/dispatches',
    );
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ ref: 'main' }));
  });

  test('GitHub từ chối thì trả 502 kèm lý do', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('No ref found', { status: 422 })));

    const res = await triggerIngest('https://x/api/ingest?secret=s3cret', env);

    expect(res.status).toBe(502);
    expect(res.body.ok).toBe(false);
  });
});
