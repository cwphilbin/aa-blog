import type { Agent, Post } from '../types';
export interface SeatAgent extends Agent {
  slug: string;
  counties: { slug: string; name: string; state: string; zips: string[] }[];
}
export function agentSchema(agent: SeatAgent) {
  const url = `https://agentsautomated.com/agents/${agent.slug}`;
  return { '@type': 'RealEstateAgent', '@id': `${url}#agent`, name: agent.name,
    ...(agent.photoUrl && { image: agent.photoUrl }),
    ...(agent.brokerage && { worksFor: { '@type': 'Organization', name: agent.brokerage } }),
    areaServed: agent.counties.map(c => ({ '@type': 'AdministrativeArea', name: `${c.name} County, ${c.state}` })),
    url, ...(agent.siteUrl && { sameAs: [agent.siteUrl] }), ...(agent.phone && { telephone: agent.phone }) };
}
export function headlineStat(post?: Post) {
  if (!post) return "";
  const headline = post.story?.headline || post.title;
  return /\d/.test(headline) ? headline : post.story?.findings.find(f => /\d/.test(f.text))?.text || headline;
}
/** Attribute an existing headline/stat verbatim; never synthesize a new number. */
export function openingSentence(agent: SeatAgent, post?: Post) {
  if (!post) return `${agent.name} shares the latest local market reports.`;
  const stat = headlineStat(post);
  return `${agent.name} of ${agent.brokerage || 'your local real estate team'} reports: ${stat.replace(/[.!?]$/, '')}.`;
}
