/**
 * Schema for a market feed file — matches exactly what the pipeline's
 * WritePostsJson Lambda produces.
 *
 * Production source:  s3://aa-content/market/{zip}/posts.json
 * One file == one ZIP territory. Local dev reads the equivalent files from
 * src/data/{zip}.json (see src/lib/posts.ts).
 *
 * Field names are the Lambda's contract — do not rename without changing the
 * Lambda. Notes on shape:
 *   - `url` is the canonical territory URL, authored by the pipeline. We treat
 *     it as the source of truth for canonicals (see src/lib/posts.ts).
 *   - Agent `photoUrl` / `siteUrl` / `ctaUrl` / `phone` / `email` may be empty
 *     strings; empty == "not provided" and is guarded in the UI.
 *   - `metrics` is a fixed-key object of numbers (0 == not available).
 *   - `slideImages` is an array of image URL strings (no alt/caption in the
 *     feed — alt text is synthesized in the templates).
 */

export type AgentTier = 'elite' | 'premium' | 'standard';

export interface Agent {
  name: string;
  tier: AgentTier;
  brokerage: string;
  license: string;
  /** May be "" — guard before rendering. */
  photoUrl: string;
  /** Agent's own website (SEO backlink). May be "". */
  siteUrl: string;
  /** Lead CTA destination. May be "". */
  ctaUrl: string;
  /** May be "". */
  phone: string;
  /** May be "". */
  email: string;
}

/** Fixed-key market metrics. 0 means "not available". */
export interface Metrics {
  /** Median sale price, whole dollars. */
  medianPrice: number;
  /** Year-over-year change, as a percentage number (e.g. 4.2 == +4.2%). */
  yoyChange: number;
  /** Active inventory (count of listings). */
  inventory: number;
  /** Median days on market. */
  daysOnMarket: number;
  /** New listings in the period. */
  newListings: number;
  /** Price per square foot, whole dollars. */
  pricePerSqft: number;
}

export interface Post {
  /** Stable feed id (e.g. "2026-06-market-update"). */
  id: string;
  /** URL-safe; becomes /market/{zip}/{slug}. Unique within the file. */
  slug: string;
  title: string;
  /** ISO date, e.g. "2026-06-15". */
  date: string;
  /** Short teaser/description. */
  summary: string;
  /** Video embed URL (YouTube/Vimeo/etc.) or a direct file. May be "". */
  videoUrl: string;
  /** Image URLs. No alt in the feed — alt is synthesized in templates. */
  slideImages: string[];
  /** Trusted, pipeline-sanitized HTML article body. */
  bodyHtml: string;
  metrics: Metrics;
}

/** Top-level shape of {zip}.json (== posts.json). */
export interface MarketFile {
  zip: string;
  /** Internal territory code, e.g. "T0032". */
  territoryCode: string;
  /** Display name, e.g. "Sacramento — Midtown / East Sacramento". */
  name: string;
  /** Canonical territory URL authored by the pipeline. Source of truth. */
  url: string;
  /** ISO timestamp of last feed update. */
  updatedAt: string;
  agent: Agent;
  posts: Post[];
}
