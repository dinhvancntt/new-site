/**
 * Google Search Console — nguồn duy nhất cho biết trang đang đứng hạng mấy ở
 * truy vấn nào. Cần service account được thêm vào property với quyền đọc.
 *
 * Toàn bộ module này là tuỳ chọn: thiếu biến môi trường thì `resolveGscConfig`
 * trả `null` và phía gọi vẫn chạy tiếp bằng Google Suggest. Không dùng thư viện
 * googleapis cho một endpoint duy nhất — JWT ký bằng `node:crypto` là đủ.
 */
import { createSign } from 'node:crypto';

const API_BASE = 'https://searchconsole.googleapis.com/webmasters/v3/sites';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_TTL_SECONDS = 3600;
const DEFAULT_ROW_LIMIT = 500;
/** Biến môi trường một dòng giữ xuống dòng dưới dạng hai ký tự. */
const ESCAPED_NEWLINE = String.raw`\n`;

export type GscConfig = {
  siteUrl: string;
  clientEmail: string;
  privateKey: string;
};

export type JwtClaims = {
  iss: string;
  scope: string;
  aud: string;
  exp: number;
  iat: number;
};

export type SearchAnalyticsBody = {
  startDate: string;
  endDate: string;
  dimensions: string[];
  rowLimit: number;
};

export function searchAnalyticsUrl(siteUrl: string): string {
  return `${API_BASE}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildSearchAnalyticsBody(options: {
  today: Date;
  days: number;
  rowLimit?: number;
}): SearchAnalyticsBody {
  const start = new Date(options.today);
  start.setUTCDate(start.getUTCDate() - options.days);

  return {
    startDate: isoDate(start),
    endDate: isoDate(options.today),
    dimensions: ['query'],
    rowLimit: options.rowLimit ?? DEFAULT_ROW_LIMIT,
  };
}

function numberOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Đổi `keys: [query]` của API thành trường phẳng cho `strikingDistance`. */
export function parseGscRows(payload: unknown): Array<{
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}> {
  const rows = (payload as { rows?: unknown })?.rows;
  if (!Array.isArray(rows)) return [];

  const parsed = [];
  for (const row of rows) {
    const keys = (row as { keys?: unknown })?.keys;
    const query = Array.isArray(keys) ? keys[0] : undefined;
    if (typeof query !== 'string' || query.trim() === '') continue;

    parsed.push({
      query,
      clicks: numberOf((row as { clicks?: unknown }).clicks),
      impressions: numberOf((row as { impressions?: unknown }).impressions),
      position: numberOf((row as { position?: unknown }).position),
    });
  }
  return parsed;
}

export function buildJwtClaims(clientEmail: string, nowSeconds: number): JwtClaims {
  return {
    iss: clientEmail,
    scope: SCOPE,
    aud: TOKEN_ENDPOINT,
    exp: nowSeconds + TOKEN_TTL_SECONDS,
    iat: nowSeconds,
  };
}

export function resolveGscConfig(env: Record<string, string | undefined>): GscConfig | null {
  const siteUrl = env.GSC_SITE_URL?.trim();
  const clientEmail = env.GSC_CLIENT_EMAIL?.trim();
  const privateKey = env.GSC_PRIVATE_KEY?.trim();
  if (!siteUrl || !clientEmail || !privateKey) return null;

  return {
    siteUrl,
    clientEmail,
    privateKey: privateKey.split(ESCAPED_NEWLINE).join('\n'),
  };
}

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** JWT bearer flow: tự ký assertion rồi đổi lấy access token ngắn hạn. */
async function requestAccessToken(config: GscConfig): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const signingInput = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url(
    buildJwtClaims(config.clientEmail, nowSeconds),
  )}`;

  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  const assertion = `${signingInput}.${signer.sign(config.privateKey).toString('base64url')}`;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`GSC token ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }

  const token = ((await response.json()) as { access_token?: string }).access_token;
  if (!token) throw new Error('GSC token: thiếu access_token trong phản hồi');
  return token;
}

export async function fetchGscRows(
  config: GscConfig,
  options: { today?: Date; days?: number; rowLimit?: number } = {},
) {
  const token = await requestAccessToken(config);
  const body = buildSearchAnalyticsBody({
    today: options.today ?? new Date(),
    days: options.days ?? 28,
    rowLimit: options.rowLimit,
  });

  const response = await fetch(searchAnalyticsUrl(config.siteUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`GSC query ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  return parseGscRows(await response.json());
}
