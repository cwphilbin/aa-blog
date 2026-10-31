import type { MarketFile } from '../types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Validate the fields templates consume before generating any routes. */
export function invalidMarketReason(value: unknown, zip: string): string | undefined {
  if (!isRecord(value)) return 'market must be an object';
  if (value.zip !== zip) return 'zip does not match its S3 path';
  for (const key of ['name', 'url']) {
    if (typeof value[key] !== 'string') return `${key} must be a string`;
  }
  if (!isRecord(value.agent)) return 'agent must be an object';
  if (typeof value.agent.name !== 'string') return 'agent.name must be a string';
  if (!Array.isArray(value.posts)) return 'posts must be an array';

  const slugs = new Set<string>();
  for (const [index, post] of value.posts.entries()) {
    const path = `posts[${index}]`;
    if (!isRecord(post)) return `${path} must be an object`;
    for (const key of ['slug', 'title', 'date', 'summary', 'videoUrl', 'bodyHtml']) {
      if (typeof post[key] !== 'string') return `${path}.${key} must be a string`;
    }
    const slug = post.slug as string;
    if (!/^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/.test(slug)) {
      return `${path}.slug must be a URL-safe slug`;
    }
    if (slugs.has(slug)) return `${path}.slug must be unique`;
    slugs.add(slug);
    if (!Number.isFinite(Date.parse(post.date as string))) return `${path}.date must be a valid date`;
    if (!Array.isArray(post.slideImages) || post.slideImages.some((image) => typeof image !== 'string')) {
      return `${path}.slideImages must be an array of strings`;
    }
    if (!isRecord(post.metrics)) return `${path}.metrics must be an object`;
    for (const key of ['medianPrice', 'yoyChange', 'inventory', 'daysOnMarket', 'newListings', 'pricePerSqft']) {
      const metric = post.metrics[key];
      if (metric !== null && (typeof metric !== 'number' || !Number.isFinite(metric))) {
        return `${path}.metrics.${key} must be a finite number or null`;
      }
    }
  }
}

/** Skip the entire invalid feed, logging only its ZIP and field-level reason. */
export function parseMarketFeed(
  text: string,
  zip: string,
  warn: (message: string) => void = console.warn,
): MarketFile | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    warn(`[markets] Skipping invalid posts.json for ZIP ${zip}: malformed JSON`);
    return undefined;
  }
  const reason = invalidMarketReason(value, zip);
  if (reason) {
    warn(`[markets] Skipping invalid posts.json for ZIP ${zip}: ${reason}`);
    return undefined;
  }
  return value as MarketFile;
}
