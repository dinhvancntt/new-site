import { test, expect } from 'vitest';
import manifest from './manifest.js';

test('describes the site in the language it still publishes', () => {
  const m = manifest();

  expect(m.lang).toBe('en');
  expect(m.start_url).toBe('/en');
  expect(m.description).toContain('Breaking world');
  expect(m.name).not.toContain('Tin quốc tế');
});
