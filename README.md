# aa-blog — SEO real estate market pages

Astro static site (SSG) that generates SEO-optimized real estate market pages
from per-ZIP `posts.json` feeds. **This is the canonical SEO asset** — the agent
embeds shipped later canonical back to these pages, so the canonical domain here
is authoritative.

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

Two path-ownership follow-ups (the main app owns the apex root):
- **Sitemap** is emitted at `/sitemap-index.xml`. Either proxy `/sitemap*.xml`
  to this site too, or add these URLs to the main app's sitemap.
- **robots.txt** at the apex is the main app's; merge the `Sitemap:` line from
  `public/robots.txt` into it.
