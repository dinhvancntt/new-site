import { describe, expect, test } from 'vitest';
import { otherLang, parseLang } from './lang';

describe('parseLang', () => {
  test('accepts the two supported languages', () => {
    expect(parseLang('vi')).toBe('vi');
    expect(parseLang('en')).toBe('en');
  });

  test('rejects anything else so the route can 404', () => {
    expect(parseLang('fr')).toBeNull();
    expect(parseLang('')).toBeNull();
    expect(parseLang(undefined)).toBeNull();
  });

  test('rejects uppercase because URLs are lowercase', () => {
    expect(parseLang('VI')).toBeNull();
  });
});

describe('otherLang', () => {
  test('flips between the language pair', () => {
    expect(otherLang('vi')).toBe('en');
    expect(otherLang('en')).toBe('vi');
  });
});
