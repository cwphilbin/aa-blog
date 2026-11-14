import {normalizeHostname,canonicalHostname,restReader,resolveAgentDomain,scopeCatalog,scopeReport} from '../../src/server/agent-domains.mjs';
import {domainPage} from '../../src/server/agent-domain-page.mjs';
const noStore={'Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'};
function response(body,status=200,type='text/html; charset=utf-8'){return new Response(body,{status,headers:{...noStore,'Content-Type':type}});}
const json=(data,status=200)=>response(JSON.stringify(data),status,'application/json');
const notFound=()=>response('<!doctype html><title>Report site unavailable</title><h1>Report site unavailable</h1>',404);
const assets=new Set(['/embed/tenant.js','/embed/money.js','/embed/report-kit/controller.js','/embed/report-kit/render.js','/embed/report-kit/design.css']);
export async function handleAgentHost(request,context,{env,read,requestContent=fetch}={}){
 const url=new URL(request.url),host=normalizeHostname(url.hostname);
 if(canonicalHostname(host))return context.next();
 if(!['GET','HEAD'].includes(request.method))return response('Method not allowed',405,'text/plain');
 try{
  env=env||{SUPABASE_URL:Netlify.env.get('SUPABASE_URL'),AA_SUPABASE_SECRET_KEY:Netlify.env.get('AA_SUPABASE_SECRET_KEY')};
  const tenant=await resolveAgentDomain(host,{read:read||restReader(env),siteId:context.site.id});
  if(!tenant)return notFound();
  if(assets.has(url.pathname)){const r=await context.next();const headers=new Headers(r.headers);Object.entries(noStore).forEach(([k,v])=>headers.set(k,v));return new Response(r.body,{status:r.status,headers});}
  const path=url.pathname.replace(/\/$/,'')||'/';
  const content=async p=>{const r=await requestContent('https://aa-blog.netlify.app'+p,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(r.status===404)return null;if(!r.ok)throw Error('Published content unavailable');return r.json();};
  if(path==='/robots.txt')return response(tenant.testOnly?'User-agent: *\nDisallow: /':'User-agent: *\nAllow: /\nSitemap: https://'+host+'/sitemap.xml',200,'text/plain');
  if(path==='/sitemap.xml')return response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://${host}/</loc></url></urlset>`,200,'application/xml');
  if(path==='/market')return new Response(null,{status:302,headers:{...noStore,Location:'/'}});
  if(path==='/'||path==='/market/reports.json'){
   const catalog=await content('/market/reports.json'),markets=scopeCatalog(catalog,tenant);
   if(path.endsWith('.json'))return json({reportingMonth:catalog.reportingMonth,markets});
   return response(domainPage(tenant,{markets,reportingMonth:catalog.reportingMonth}));
  }
  const match=/^\/market\/(\d{5})(?:\/([a-z0-9][a-z0-9.-]*))?$/.exec(path);
  if(!match||!tenant.zips.has(match[1]))return notFound();
  const zip=match[1],slug=match[2];
  const c=tenant.agent.counties.find(c=>c.zips.includes(zip));
  const full=scopeReport(await content(`/market/${zip}/report-data.json`)||{zip,name:`${c.name} County, ${c.state}`,posts:[]},tenant);
  if(!full)return notFound();
  if(slug==='report-data.json')return json(full);
  const post=slug?full.posts.find(p=>p.slug===slug):full.posts[0];
  if(slug&&!post)return notFound();
  return response(domainPage(tenant,{market:full,post,path}));
 }catch{return response('<!doctype html><title>Reports temporarily unavailable</title><h1>Reports temporarily unavailable</h1>',503);}
}
export default handleAgentHost;
