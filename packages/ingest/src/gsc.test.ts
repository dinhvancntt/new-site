import { describe, expect, test } from 'vitest';
import {
  buildJwtClaims,
  buildSearchAnalyticsBody,
  parseGscRows,
  resolveGscConfig,
  searchAnalyticsUrl,
} from './gsc.js';

describe('searchAnalyticsUrl', () => {
  test('mã hoá property dạng sc-domain để không vỡ đường dẫn', () => {
    expect(searchAnalyticsUrl('sc-domain:example.com')).toBe(
      'https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.com/searchAnalytics/query',
    );
  });

  test('mã hoá property dạng URL đầy đủ', () => {
    expect(searchAnalyticsUrl('https://example.com/')).toContain('https%3A%2F%2Fexample.com%2F');
  });
});

describe('buildSearchAnalyticsBody', () => {
  const today = new Date('2026-09-14T00:00:00Z');

  test('hỏi theo chiều truy vấn, đúng cửa sổ ngày yêu cầu', () => {
    const body = buildSearchAnalyticsBody({ today, days: 28 });
    expect(body.dimensions).toEqual(['query']);
    expect(body.endDate).toBe('2026-09-14');
    expect(body.startDate).toBe('2026-08-17');
  });

  test('giới hạn số dòng để một lần gọi không kéo về cả kho', () => {
    expect(buildSearchAnalyticsBody({ today, days: 28, rowLimit: 250 }).rowLimit).toBe(250);
  });
});

describe('parseGscRows', () => {
  test('trải keys thành trường query dùng được ngay', () => {
    const payload = {
      rows: [{ keys: ['f1 sprint format'], clicks: 3, impressions: 420, position: 12.4 }],
    };
    expect(parseGscRows(payload)).toEqual([
      { query: 'f1 sprint format', clicks: 3, impressions: 420, position: 12.4 },
    ]);
  });

  test('bỏ qua dòng thiếu keys thay vì tạo truy vấn rỗng', () => {
    const payload = { rows: [{ clicks: 1, impressions: 10, position: 5 }, { keys: [] }] };
    expect(parseGscRows(payload)).toEqual([]);
  });

  test('trả mảng rỗng khi property chưa có dữ liệu', () => {
    expect(parseGscRows({})).toEqual([]);
  });
});

describe('buildJwtClaims', () => {
  test('xin đúng phạm vi chỉ đọc của Search Console', () => {
    const claims = buildJwtClaims('bot@project.iam.gserviceaccount.com', 1_780_000_000);
    expect(claims.scope).toBe('https://www.googleapis.com/auth/webmasters.readonly');
    expect(claims.iss).toBe('bot@project.iam.gserviceaccount.com');
  });

  test('token sống một giờ, không dài hơn mức Google chấp nhận', () => {
    const claims = buildJwtClaims('bot@project.iam.gserviceaccount.com', 1_780_000_000);
    expect(claims.exp - claims.iat).toBe(3600);
  });
});

describe('resolveGscConfig', () => {
  test('trả null khi chưa cấu hình, để chỗ gọi tự đi tiếp không cần GSC', () => {
    expect(resolveGscConfig({})).toBeNull();
  });

  test('trả null khi mới có một nửa cấu hình', () => {
    expect(resolveGscConfig({ GSC_SITE_URL: 'sc-domain:example.com' })).toBeNull();
  });

  test('khôi phục xuống dòng thật trong private key dán từ biến môi trường', () => {
    const esc = String.raw`\n`;
    const config = resolveGscConfig({
      GSC_SITE_URL: 'sc-domain:example.com',
      GSC_CLIENT_EMAIL: 'bot@project.iam.gserviceaccount.com',
      GSC_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----${esc}abc${esc}-----END PRIVATE KEY-----`,
    });
    expect(config?.privateKey).toContain('\n');
    expect(config?.privateKey).not.toContain(esc);
  });
});
