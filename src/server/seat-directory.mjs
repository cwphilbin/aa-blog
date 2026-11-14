/** Server-only re-data lookup. Never export credentials or private agent columns. */
export const safeUrl = value => {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; }
  catch { return ''; }
};
export function projectSeats(counties, agents, links) {
  const directory = { agents: [], zips: {} };
  for (const county of counties) {
    if (!county.is_sellable || !county.seat_agent_id || !['active', 'past_due'].includes(county.subscription_status)) continue;
    const row = agents.find(a => a.id === county.seat_agent_id);
    if (!row?.full_name?.trim()) throw new Error('Active county seat has no public agent profile');
    const slug = `${row.full_name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${row.id.slice(0, 8)}`;
    let agent = directory.agents.find(a => a.slug === slug);
    if (!agent) {
      agent = { id: row.id, slug, name: row.full_name.trim(), tier: 'standard', brokerage: row.brokerage || '',
        cta_type: row.cta_type || '', cta_label: row.cta_label || '', cta_value: row.cta_value || '',
        logoUrl: safeUrl(row.logo_url), photoUrl: safeUrl(row.headshot_url), siteUrl: safeUrl(row.website), phone: row.phone || '',
        city: row.city || '', state: row.state || '', ctaUrl: safeUrl(row.website), license: '', email: '', counties: [] };
      directory.agents.push(agent);
    }
    const zips = [...new Set(links.filter(l => l.county_id === county.id).map(l => l.zip))].sort();
    agent.counties.push({ slug: county.slug, name: county.county, state: county.state, zips });
    for (const zip of zips) directory.zips[zip] = slug;
  }
  return directory;
}
export async function loadSeatDirectory(env = process.env, request = fetch) {
  const origin = env.SUPABASE_URL;
  const key = env.AA_SUPABASE_SECRET_KEY;
  if (!origin || !key) throw new Error('Set server-only SUPABASE_URL and AA_SUPABASE_SECRET_KEY for current seat attribution');
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  async function rows(table, select, filter = '') {
    const result = [];
    for (let offset = 0; ; offset += 1000) {
      const url = `${origin.replace(/\/$/, '')}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=id&limit=1000&offset=${offset}${filter}`;
      const response = await request(url, { headers, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Current seat lookup failed (${table}, HTTP ${response.status})`);
      const page = await response.json();
      if (!Array.isArray(page)) throw new Error('Invalid current seat response');
      result.push(...page);
      if (page.length < 1000) return result;
    }
  }
  const counties = await rows('counties', 'id,county,state,slug,is_sellable,seat_agent_id,subscription_status');
  const active = counties.filter(c => c.is_sellable && c.seat_agent_id && ['active','past_due'].includes(c.subscription_status));
  if (!active.length) return { agents: [], zips: {} };
  const ids = [...new Set(active.map(c => c.seat_agent_id))];
  const agents = await rows('agents', 'id,full_name,brokerage,headshot_url,logo_url,website,phone,cta_type,cta_label,cta_value', `&id=in.(${ids.join(',')})`);
  // zip_counties uses zip as its primary key, not id.
  const links = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await request(`${origin}/rest/v1/zip_counties?select=zip,county_id&order=zip&limit=1000&offset=${offset}`, { headers, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`ZIP county lookup failed (HTTP ${r.status})`);
    const page = await r.json(); links.push(...page); if (page.length < 1000) break;
  }
  return projectSeats(counties, agents, links);
}
