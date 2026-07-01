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

Sample feeds in `src/data/{zip}.json` (mirror `aa-content/market/{zip}/posts.json`):

- `95816.json` — Sacramento Midtown/East Sac, **elite** agent, 2 posts
- `94110.json` — SF Mission, **premium** agent
- `78704.json` — South Austin, **standard** agent

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

### Swapping local samples for S3

Feeds are read from `src/data/*.json` (glob in `src/lib/posts.ts`). In production
they come from `s3://aa-content/market/{zip}/posts.json`. Replace the glob with an
async fetch (list ZIPs → GET each `posts.json`); the templates only call
`getAllMarkets()` / `getMarket()` / `getPosts()` and don't care about the source.

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
- Reads `data-zip`, fetches `{base}/{zip}/posts.json`. `base` is a config
  constant at the top of `embed.js` (**stubbed** to `cdn.agentsautomated.com/market`
  — point it at the real S3/CloudFront origin once provisioned). Overridable per
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
- **Coming-soon** state if `posts.json` 404s (new signup before first content).
- Inherits host typography (`font-family: inherit`) but sets its own layout
  (cards, spacing, 16:9 video); all styles scoped under `#aa-blog`. XSS-safe:
  text via `textContent`, `innerHTML` only for the trusted `bodyHtml`.

**Test it locally:** `npm run dev`, then open
[`http://localhost:4321/embed-test.html`](http://localhost:4321/embed-test.html)
— a mock agent site (serif host font) with a live canonical-inspector bar.
Switch tiers with `?zip=95816` (elite) · `94110` (premium) · `78704` (standard) ·
`00000` (coming-soon). `embed-test.html` + `public/dev-data/` are dev-only
fixtures — kept in the repo but **stripped from the production build** by the
`postbuild` script.

## Deployment (path-based on the apex)

`agentsautomated.com` already serves the main app, so this static site is
published separately and mounted at `/market/*` by the apex's edge. Options,
best first:

1. **Reverse-proxy / rewrite at the apex (recommended).** Deploy this as its own
   Netlify site; on whatever serves `agentsautomated.com`, add a rewrite
   `("/market/*" → this site)`. Keeps the two codebases and deploy cadences
   independent. On Netlify that's a `[[redirects]]` rule with `status = 200`
   (proxy) to this site's URL; on Vercel a `rewrites` entry.
2. **Build artifact merge.** Have the main app's build pull `dist/market/**` into
   its own output. Simplest routing, but couples the deploys.

Either way, keep Astro `site = https://agentsautomated.com` (already set) so
canonicals/OG/sitemap stay on the apex.

Path-ownership follow-ups (the main app owns the apex root, so these live outside
`/market/*` and each needs its own proxy rule or handling):
- **`/embed.js`** — the embed loads from `https://agentsautomated.com/embed.js`,
  at the apex root. The apex must proxy **`/embed.js`** (status 200) to this
  Netlify site, alongside the `/market/*` rule. The `posts.json` origin the embed
  fetches (`base` constant in `embed.js`) is served directly from S3/CloudFront,
  not the apex, so it needs no rule — just CORS allowing the agents' origins.
- **Sitemap** is emitted at `/sitemap-index.xml`. Either proxy `/sitemap*.xml`
  to this site too, or add these URLs to the main app's sitemap.
- **robots.txt** at the apex is the main app's; merge the `Sitemap:` line from
  `public/robots.txt` into it.
