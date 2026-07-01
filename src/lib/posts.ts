import type { Agent, MarketFile, Post } from '../types';

/**
 * Loads all market feeds at build time.
 *
 * TODAY: reads local sample files from src/data/*.json.
 * LATER: swap the glob for an S3 fetch of aa-content/market/{zip}/posts.json.
 *        The page templates only call the helpers below, so the source swap is
 *        contained to this file:
 *          const zips = await listMarketZips();          // S3 ListObjects
 *          return Promise.all(zips.map(getMarketFromS3)); // GET each posts.json
 */

const feeds = import.meta.glob<MarketFile>('../data/*.json', {
  eager: true,
  import: 'default',
});

const markets: MarketFile[] = Object.values(feeds).sort((a, b) =>
  a.zip.localeCompare(b.zip),
);

export function getAllMarkets(): MarketFile[] {
  return markets;
}

export function getMarket(zip: string): MarketFile | undefined {
  return markets.find((m) => m.zip === zip);
}

/** Posts newest-first by `date`. */
export function getPosts(market: MarketFile): Post[] {
  return [...market.posts].sort(
    (a, b) => +new Date(b.date) - +new Date(a.date),
  );
}

/** Maps agent tier → where its feature block mounts in the page DOM. */
export function placementFor(tier: Agent['tier']): 'hero' | 'sidebar' | 'footer' {
  if (tier === 'elite') return 'hero';
  if (tier === 'premium') return 'sidebar';
  return 'footer';
}

/** Treats "" / whitespace-only feed fields as "not provided". */
export function hasText(value?: string | null): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** First slide image, used as the cover / OG image (feed has no coverImage). */
export function coverImage(post: Post): string | undefined {
  return post.slideImages.find(hasText);
}

/**
 * Canonical URL for a post, derived from the pipeline's authored territory
 * `url` (source of truth) — NOT reconstructed from the local path.
 */
export function postCanonical(market: MarketFile, post: Post): string {
  return `${market.url.replace(/\/$/, '')}/${post.slug}`;
}
