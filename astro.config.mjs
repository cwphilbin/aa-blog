// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The canonical origin for this SEO asset. Path-based on purpose: these pages
// live at agentsautomated.com/market/* so all SEO authority concentrates on the
// one apex domain (NOT a blog subdomain). Matches the pipeline feed's `url`.
// Override with SITE_URL in Netlify only if the apex ever changes.
const SITE_URL = process.env.SITE_URL || 'https://agentsautomated.com';

// https://astro.build/config
export default defineConfig({
  // `site` is what powers canonical URLs, Open Graph URLs, and JSON-LD.
  // It MUST be the domain we own — this is the whole point of the asset.
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'never',
  integrations: [sitemap()],
  build: {
    // Emit /market/95816/index.html style files (clean URLs on Netlify).
    format: 'directory',
  },
});
