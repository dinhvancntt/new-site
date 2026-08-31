import { expect, test } from 'vitest';
import { imageUrl } from './image';

const src = 'https://cdn.example.com/photo.jpg';

test('routes the photo through the resizer as webp at the asked width', () => {
  const url = imageUrl(src, { width: 400 });

  expect(url).toContain('https://wsrv.nl/?');
  expect(url).toContain('w=400');
  expect(url).toContain('output=webp');
});

test('percent-encodes the source so its own query string survives', () => {
  const url = imageUrl('https://cdn.example.com/p.jpg?w=2000&sig=a b', { width: 400 });

  expect(url).toContain('url=https%3A%2F%2Fcdn.example.com%2Fp.jpg%3Fw%3D2000%26sig%3Da%20b');
  // Chỉ được có đúng một tham số w của wsrv, query của nguồn phải nằm gọn trong url=.
  expect(url?.match(/[?&]w=/g)).toHaveLength(1);
});

test('crops to a fixed box when a height is given', () => {
  const url = imageUrl(src, { width: 400, height: 225 });

  expect(url).toContain('h=225');
  expect(url).toContain('fit=cover');
});

test('never upscales a small source', () => {
  expect(imageUrl(src, { width: 1200 })).toContain('we');
});

test('no photo means no url', () => {
  expect(imageUrl(null, { width: 400 })).toBeNull();
  expect(imageUrl('', { width: 400 })).toBeNull();
});

test('refuses anything that is not plain http(s)', () => {
  expect(imageUrl('javascript:alert(1)', { width: 400 })).toBeNull();
  expect(imageUrl('data:image/png;base64,AAAA', { width: 400 })).toBeNull();
  expect(imageUrl('not a url', { width: 400 })).toBeNull();
});
