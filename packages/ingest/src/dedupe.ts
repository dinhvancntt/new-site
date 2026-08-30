import { createHash } from 'node:crypto';

export function titleHash(title: string): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  return createHash('sha256').update(normalized).digest('hex');
}

export type ArticleKey = { sourceId: string; title: string };

export type ExistingKeys = {
  sourceIds: Set<string>;
  titleHashes: Set<string>;
};

export function selectNewArticles<T extends ArticleKey>(
  fetched: readonly T[],
  existing: ExistingKeys,
): T[] {
  const seenTitles = new Set(existing.titleHashes);
  const kept: T[] = [];

  for (const candidate of fetched) {
    if (existing.sourceIds.has(candidate.sourceId)) continue;

    const hash = titleHash(candidate.title);
    if (seenTitles.has(hash)) continue;

    seenTitles.add(hash);
    kept.push(candidate);
  }

  return kept;
}
