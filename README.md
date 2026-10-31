# aa-blog — SEO real estate market pages

Astro static site (SSG) that generates SEO-optimized real estate market pages
from per-ZIP `posts.json` feeds. **This is the canonical SEO asset** — the agent
[embed](#embed-the-product-embedjs) canonicals back to these pages, so the
canonical domain here is authoritative.

Two products in this repo:
1. **The static site** (`src/`) — the canonical pages at `agentsautomated.com/market/*`.
2. **The embed** (`public/embed.js`) — the drop-in widget agents paste on their
   own site; it renders our content inline and injects `rel=canonical` back here.

## Domain & routing (important)

Pages live at **`https://agentsautomated.com/market/*`** — path-based on the apex
on purpose, to concentrate SEO authority on one domain (no `blog.` subdomain).
The canonical for each page is the pipeline feed's authored `url`
(`agentsautomated.com/market/{zip}`), which the templates use verbatim. See
**Deployment** for how this coexists with the main app already on the apex.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:4321/market
npm run build    # -> dist/  (static HTML, what Netlify publishes)
npm run preview  # serve the built dist/ locally
```

## Pages

| Route                     | What it is                                                    |
| ------------------------- | ------------------------------------------------------------- |
| `/market`                 | Index of all markets                                          |
| `/market/{zip}`           | Territory landing — lists the ZIP's posts, features the agent |
| `/market/{zip}/{slug}`    | Individual post — `bodyHtml`, video, slides, metrics          |

Everything this site emits is under `/market/*` (plus `sitemap-*.xml`,
`robots.txt`, `favicon.svg`). The apex root `/` belongs to the main app.

## SEO (the whole point)

Built into static HTML, zero JS by default:

- `<link rel="canonical">` = the feed's authored `url` on **our** apex domain
- `schema.org` JSON-LD — `BlogPosting` on posts (headline, datePublished,
  `author` = agent, `publisher` = Agents Automated), `CollectionPage` +
  `BreadcrumbList` on landing pages, `VideoObject` when a post has video
- Open Graph + Twitter tags
- Semantic HTML, system fonts (no render-blocking web fonts), lazy images
- `sitemap-index.xml` (via `@astrojs/sitemap`) + `robots.txt`

## Agent feature block — prominence by tier

Driven by `agent.tier` (`src/components/AgentBlock.astro`, placement map in
`src/lib/posts.ts`):

| Tier       | Placement                            | Contents                        |
| ---------- | ------------------------------------ | ------------------------------- |
| `elite`    | Hero, above the fold                 | Photo, brokerage/license, CTA   |
| `premium`  | Sidebar card (beside the article)    | Photo + CTA                     |
| `standard` | Footer "presented by" strip          | Name + link                     |

Every tier links to **`agent.siteUrl`** (SEO backlink, followed) and
**`agent.ctaUrl`** (lead CTA, `rel="nofollow sponsored"`). Empty-string feed
values (`""`) are treated as "not provided" and the link/image is dropped.

> ⚠️ The feed has **no `bio` field**, so the elite hero shows brokerage + license
> instead of a bio paragraph. To restore a "full bio", the WritePostsJson Lambda
> must emit `agent.bio`.

## Data & schema

Published canonical stories are read at build time from
`s3://aa-zip-metrics-prod/stories/{month}/{zip}.json` (schema version 1).
The newest post's story appears on its ZIP landing page; each monthly post uses
its own month, derived from its content ID before its publication date. Both
render headline, TL;DR, trend chart, findings, context, what changed (`shift`),
proof (including the comparison chart), takeaway, and CTA in that order.
Story text is escaped, not inserted as HTML. Chart URLs must belong to the same
story's public S3 directory. Page titles and descriptions use the canonical story.

The build lists `stories/` and reads only matching JSON objects, with bounded
concurrency. Missing or malformed stories retain the existing feed-based pages;
they never remove routes. Malformed stories log a ZIP/month warning. AWS access
failures still fail the build. Existing null-metric and malformed-feed safeguards
remain in place. The build IAM user needs the additional read-only permissions in
`infra/netlify-story-read-policy.json`; chart images must be publicly readable.

The production feeds are written to
`s3://agentsautomated-content/market/{zip}/posts.json` in `us-east-2` and served
publicly at
`https://agentsautomated-content.s3.us-east-2.amazonaws.com/market/{zip}/posts.json`.

Schema (exactly the WritePostsJson Lambda output — documented in `src/types.ts`):

```jsonc
{
  "zip": "95816",
  "territoryCode": "T0032",
  "name": "Sacramento — Midtown / East Sacramento",
  "url": "https://agentsautomated.com/market/95816",   // canonical, source of truth
  "updatedAt": "2026-06-15T10:00:00Z",
  "agent": {
    "name": "Jane Doe", "tier": "elite", "brokerage": "...", "license": "...",
    "photoUrl": "", "siteUrl": "", "ctaUrl": "", "phone": "", "email": ""  // may be ""
  },
  "posts": [{
    "id": "2026-06-market-update",
    "slug": "june-2026-market-update",
    "title": "...", "date": "2026-06-15", "summary": "...",
    "videoUrl": "", "slideImages": ["https://.../a.jpg"], "bodyHtml": "<p>...</p>",
    "metrics": {
      "medianPrice": 685000, "yoyChange": 4.2, "inventory": 38,
      "daysOnMarket": 12, "newListings": 27, "pricePerSqft": 512
    }
  }]
}
```

Template assumptions worth confirming against real feed data:
- `slideImages` is treated as `string[]` (URLs). The feed carries **no alt text**,
  so alt is synthesized (`"{title} — image N"`). First slide = cover/OG image.
- `metrics.yoyChange` is read as a **percent number** (`4.2` → "+4.2%"), sign
  drives the trend arrow. A metric of `0` is hidden (treated as "not available"),
  except `yoyChange` where `0` renders as flat.

### Static build data flow

`src/lib/posts.ts` lists `market/` objects in the production bucket during the
Astro build, extracts ZIPs from keys matching `market/{zip}/posts.json`, and
fetches each feed from the public HTTPS origin. The route templates call
`getStaticPaths()`, so `/market/{zip}` and `/market/{zip}/{slug}` are generated
as static HTML only when that ZIP has a `posts.json` object at build time.

The Netlify build needs AWS credentials with `s3:ListBucket` limited to the
`market/` prefix. Feed downloads themselves are anonymous HTTPS requests; a
public-read or object-listing error fails the build. Malformed JSON or invalid
template data skips that ZIP's feed with a warning identifying the ZIP and field;
valid feeds continue to build. Null metric values mean unavailable and their
cells are hidden; they do not cause a feed to be skipped. The build reports
loaded/skipped feed counts. Skipped feeds have no generated pages or sitemap
entries until corrected. A ZIP with no object is absent from
the object listing, so no static page is generated until a later build after
WritePostsJson creates it.

### Required Netlify build environment variables

Add these variables in the Netlify UI with **Builds** scope:

| Variable | Purpose |
| --- | --- |
| `AA_AWS_ACCESS_KEY_ID` | Access key for the list-only Netlify build IAM user |
| `AA_AWS_SECRET_ACCESS_KEY` | Secret key for the list-only Netlify build IAM user |

Netlify reserves the standard `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY` names, so `src/lib/posts.ts` passes the AA-prefixed
values explicitly to `S3Client`. The build fails immediately with the missing
variable names if either value is absent. Never commit credential values.

The S3 region is fixed to `us-east-2` in `src/lib/posts.ts`. `AWS_REGION` in
`netlify.toml` is build configuration rather than a secret; no
`AA_AWS_REGION` variable is required in the Netlify UI.

## Embed — the product (`embed.js`)

The drop-in widget agents paste on their **own** site. It renders our blog
content inline and — the whole point — injects `rel=canonical` back to our page
so we keep the SEO ranking (the DropInBlog model). Self-contained vanilla JS, no
framework, no build step, one file served from our domain.

**What the agent pastes (two lines):**

```html
<div id="aa-blog" data-zip="95816"></div>
<script async src="https://agentsautomated.com/embed.js"></script>
```

**Behavior:**
- Reads `data-zip`, fetches `{base}/{zip}/posts.json`. `base` is the production
  S3 HTTPS origin at the top of `embed.js`. Overridable per
  embed via `data-base`, or globally via `window.AA_BLOG_CONFIG = { base, canonicalBase }`.
- Renders list + individual post views; hash routing (`#post={slug}`) so deep
  links and back/forward work.
- **Canonical injection (load-bearing):** on a post view it sets aside any host
  `rel=canonical`, injects `<link rel="canonical" href="https://agentsautomated.com/market/{zip}/{slug}" data-aa-blog>`,
  and restores the host's when you return to the list — so there's always exactly
  one canonical and ours wins on post pages.
- **Lazy video:** click-to-load facade (YouTube thumbnail, zero third-party
  requests until play) → `youtube-nocookie` iframe on click; direct files use
  native `<video>`. Protects the agent's Core Web Vitals.
- **Coming-soon** state if `posts.json` is missing or cannot be loaded (new
  signup before first content).
- Inherits host typography (`font-family: inherit`) but sets its own layout
  (cards, spacing, 16:9 video); all styles scoped under `#aa-blog`. XSS-safe:
  text via `textContent`, `innerHTML` only for the trusted `bodyHtml`.

**Test it locally:** `npm run dev`, then open
[`http://localhost:4321/embed-test.html`](http://localhost:4321/embed-test.html)
— a mock agent site (serif host font) with a live canonical-inspector bar.
Use `?zip={zip}` to load any production feed, or a ZIP with no feed to exercise
the coming-soon state. `embed-test.html` is a dev-only harness and is
**stripped from the production build** by the `postbuild` script.

## Deployment (path-based on the apex)

`agentsautomated.com` already serves the main app, so this static site is
published separately and mounted at `/market/*` by the apex's edge. Options,
best first:

1. **Reverse-proxy / rewrite at the apex (recommended).** Deploy this as its own
   Netlify site. The apex app's `public/_redirects` proxies `/market/*` and
   `/embed.js` to `https://aa-blog.netlify.app` with status `200`, before its SPA
   catch-all. This keeps the two codebases and deploy cadences independent.
2. **Build artifact merge.** Have the main app's build pull `dist/market/**` into
   its own output. Simplest routing, but couples the deploys.

Either way, keep Astro `site = https://agentsautomated.com` (already set) so
canonicals/OG/sitemap stay on the apex.

Path-ownership follow-ups (the main app owns the apex root, so these live outside
`/market/*` and each needs its own proxy rule or handling):
- **`/embed.js`** — the embed loads from `https://agentsautomated.com/embed.js`,
  at the apex root. The apex must proxy **`/embed.js`** (status 200) to this
  Netlify site, alongside the `/market/*` rule. The `posts.json` origin the embed
  fetches (`base` constant in `embed.js`) is served directly from S3, not the
  apex, so it needs no rule — just CORS allowing the agents' origins.
- **Sitemap** is emitted at `/sitemap-index.xml`. Either proxy `/sitemap*.xml`
  to this site too, or add these URLs to the main app's sitemap.
- **robots.txt** at the apex is the main app's; merge the `Sitemap:` line from
  `public/robots.txt` into it.
