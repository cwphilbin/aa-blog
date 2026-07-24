import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import type { Agent, MarketFile, Post } from '../types';

/** Production feed location written by WritePostsJson. */
export const POSTS_ORIGIN =
  'https://agentsautomated-content.s3.us-east-2.amazonaws.com/market';

const POSTS_BUCKET = 'agentsautomated-content';
const POSTS_PREFIX = 'market/';
const POSTS_REGION = 'us-east-2';
const POSTS_KEY = /^market\/(\d{5})\/posts\.json$/;

const accessKeyId = process.env.AA_AWS_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.AA_AWS_SECRET_ACCESS_KEY?.trim();

if (!accessKeyId || !secretAccessKey) {
  const missingCredentialVariables = [
    !accessKeyId && 'AA_AWS_ACCESS_KEY_ID',
    !secretAccessKey && 'AA_AWS_SECRET_ACCESS_KEY',
  ].filter((name): name is string => Boolean(name));

  throw new Error(
    `Missing required Netlify build environment variable(s): ${missingCredentialVariables.join(', ')}. Add them in Netlify with Builds scope.`,
  );
}

/**
 * Loads all market feeds from production S3 during the Astro build.
 *
 * Object listing uses explicit, Netlify-scoped AWS credentials and requires
 * only s3:ListBucket on `market/`. Each feed is then fetched through the same
 * public HTTPS origin used by embed.js, so a bad public-read policy fails the
 * build instead of producing pages that the embed cannot load.
 */
async function loadMarkets(): Promise<MarketFile[]> {
  const s3 = new S3Client({
    region: POSTS_REGION,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
  const zips = new Set<string>();
  let continuationToken: string | undefined;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: POSTS_BUCKET,
        Prefix: POSTS_PREFIX,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of page.Contents ?? []) {
      const match = object.Key?.match(POSTS_KEY);
      if (match) zips.add(match[1]);
    }

    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);

  const feeds = await Promise.all(
    [...zips].sort().map(async (zip): Promise<MarketFile> => {
      const url = `${POSTS_ORIGIN}/${encodeURIComponent(zip)}/posts.json`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Could not load posts for ZIP ${zip}: ${response.status} ${response.statusText} (${url})`,
        );
      }

      const market = (await response.json()) as MarketFile;
      if (market.zip !== zip || !Array.isArray(market.posts)) {
        throw new Error(`Invalid posts.json for ZIP ${zip} (${url})`);
      }

      return market;
    }),
  );

  return feeds.sort((a, b) => a.zip.localeCompare(b.zip));
}

const markets = await loadMarkets();

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
