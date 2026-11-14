import {parse} from 'tldts';
import {projectSeats} from './seat-directory.mjs';
export const TARGET='reports.agentsautomated.com';
export const TEST_HOST='test-agent.agentsautomated.com';
export function normalizeHostname(value){return typeof value==='string'?value.toLowerCase().replace(/\.$/,''):'';}
export function validAgentHostname(value,{testOnly=false}={}){
 const host=normalizeHostname(value);
 if(testOnly)return host===TEST_HOST;
 if(host.length>253||!/^[a-z0-9.-]+$/.test(host)||host.split('.').some(x=>!x||x.length>63||x.startsWith('-')||x.endsWith('-')))return false;
 const p=parse(host,{allowPrivateDomains:true});
 return !!p.isIcann&&!p.isIp&&!!p.domain&&!!p.subdomain&&!['agentsautomated.com','netlify.app'].some(d=>host===d||host.endsWith('.'+d));
}
export function canonicalHostname(host){return ['reports.agentsautomated.com','aa-blog.netlify.app','agentsautomated.com','www.agentsautomated.com'].includes(host)||/^[a-f0-9]{24}--aa-blog\.netlify\.app$/.test(host);}
export function restReader(env,request=fetch){
 const origin=env.SUPABASE_URL,key=env.AA_SUPABASE_SECRET_KEY;
 if(!origin||!key)throw Error('Domain service is not configured');
 return async function rows(table,query){
  const all=[];
  for(let offset=0;;offset+=1000){
   const r=await request(`${origin.replace(/\/$/,'')}/rest/v1/${table}?${query}&limit=1000&offset=${offset}`,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000),cache:'no-store'});
   if(!r.ok)throw Error(`Domain lookup failed (${table}, ${r.status})`);
   const page=await r.json();if(!Array.isArray(page))throw Error('Invalid domain lookup');all.push(...page);if(page.length<1000)return all;
  }
 };
}
export async function resolveAgentDomain(host,{read,siteId,now=Date.now()}){
 host=normalizeHostname(host);if(!validAgentHostname(host,{testOnly:host===TEST_HOST}))return null;
 const [binding]=await read('agent_report_domains',`select=*&hostname=eq.${encodeURIComponent(host)}`);
 if(!binding||binding.status!=='live'||!binding.ownership_verified_at||!binding.tls_verified_at||binding.netlify_site_id!==siteId||(binding.expires_at&&Date.parse(binding.expires_at)<=now))return null;
 if(binding.test_only&&host!==TEST_HOST)return null;
 const [profile]=await read('agents',`select=id,full_name,brokerage,headshot_url,logo_url,website,phone,cta_type,cta_label,cta_value,report_display_mode,report_subdomain&id=eq.${binding.agent_id}`);
 if(!profile||(!binding.test_only&&(profile.report_display_mode!=='subdomain'||normalizeHostname(profile.report_subdomain)!==host)))return null;
 let counties=await read('counties',`select=id,county,state,slug,is_sellable,seat_agent_id,subscription_status&seat_agent_id=eq.${profile.id}&order=id`);
 counties=counties.filter(c=>c.is_sellable&&['active','past_due'].includes(c.subscription_status));
 if(binding.test_only){
  const seats=await read('agent_report_test_seats',`select=agent_id,county_id,expires_at&hostname=eq.${host}&agent_id=eq.${profile.id}`);
  const ids=seats.filter(s=>Date.parse(s.expires_at)>now).map(s=>s.county_id);
  if(ids.length){const testCounties=await read('counties',`select=id,county,state,slug,is_sellable,seat_agent_id,subscription_status&id=in.(${ids.join(',')})&order=id`);
   counties=testCounties.filter(c=>c.is_sellable&&!c.seat_agent_id).map(c=>({...c,seat_agent_id:profile.id,subscription_status:'active'}));
  }else counties=[];
 }
 if(!counties.length)return null;
 const links=await read('zip_counties',`select=zip,county_id&county_id=in.(${counties.map(c=>c.id).join(',')})&order=zip`);
 const directory=projectSeats(counties,[profile],links),agent=directory.agents[0];
 if(!agent||!Object.keys(directory.zips).length)return null;
 return {hostname:host,agent,zips:new Set(Object.keys(directory.zips)),testOnly:binding.test_only};
}
export function scopeCatalog(catalog,tenant){
 const source=new Map(catalog.markets.map(m=>[m.zip,m]));
 return [...tenant.zips].sort().map(zip=>{const c=tenant.agent.counties.find(c=>c.zips.includes(zip));const m=source.get(zip);return {zip,name:m?.name||`${c.name} County, ${c.state}`,posts:(m?.posts||[]).map(p=>({...p,videoUrl:''}))};});
}
// Public AA narration and chart assets are shared; embedded agent-specific video
// cannot be rebranded. Only explicitly identified current-agent video is reused.
export function scopeReport(full,tenant){
 if(!full||!tenant.zips.has(full.zip))return null;
 return {...full,agent:tenant.agent,posts:(full.posts||[]).map(p=>({...p,videoUrl:p.videoAgentId===tenant.agent.id?p.videoUrl:'',bodyHtml:''}))};
}
