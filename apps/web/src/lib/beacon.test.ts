import { describe, expect, it } from 'vitest';
import { cfBeacon } from './beacon';

describe('cfBeacon', () => {
  it('returns null when token is missing', () => {
    expect(cfBeacon(undefined)).toBeNull();
  });

  it('returns null when token is blank', () => {
    expect(cfBeacon('   ')).toBeNull();
  });

  it('points at the Cloudflare insights beacon', () => {
    const beacon = cfBeacon('abc123');

    expect(beacon?.src).toBe('https://static.cloudflareinsights.com/beacon.min.js');
  });

  it('carries the token as the JSON payload Cloudflare expects', () => {
    const beacon = cfBeacon('abc123');

    expect(JSON.parse(beacon?.data ?? '')).toEqual({ token: 'abc123' });
  });

  it('trims surrounding whitespace off a pasted token', () => {
    const beacon = cfBeacon('\n abc123 ');

    expect(JSON.parse(beacon?.data ?? '')).toEqual({ token: 'abc123' });
  });
});
