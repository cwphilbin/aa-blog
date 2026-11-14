/** Operator-only domain approval. Credentials are read from the environment, never logged. */
import {resolveCname} from 'node:dns/promises';
import {normalizeHostname,validAgentHostname,restReader,resolveAgentDomain,TARGET,TEST_HOST} from '../../src/server/agent-domains.mjs';
const [command,input,agentId]=process.argv.slice(2),host=normalizeHostname(input||'');
const siteId=process.env.NETLIFY_SITE_ID;
if(!siteId||!process.env.NETLIFY_AUTH_TOKEN)throw Error('Set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN in the operator environment');
const env=process.env,read=restReader(env),stamp=()=>new Date().toISOString();
async function db(table,body,method='POST',query=''){
 const r=await fetch(`${env.SUPABASE_URL}/rest/v1/${table}${query?'?'+query:''}`,{method,headers:{apikey:env.AA_SUPABASE_SECRET_KEY,Authorization:`Bearer ${env.AA_SUPABASE_SECRET_KEY}`,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(body)});
 if(!r.ok)throw Error(`Registry operation failed (${r.status})`);return r.json();
}
async function netlify(path,body,method){const r=await fetch('https://api.netlify.com/api/v1'+path,{method:method||'GET',headers:{Authorization:`Bearer ${env.NETLIFY_AUTH_TOKEN}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error(`Hosting operation failed (${r.status})`);return r.json();}
async function dnsCheck(h){const aliases=await resolveCname(h);if(!aliases.some(a=>normalizeHostname(a)===TARGET))throw Error('CNAME does not match '+TARGET);}
async function disable(binding){await db('agent_report_domains',{status:'disabled',updated_at:stamp()},'PATCH','hostname=eq.'+encodeURIComponent(binding.hostname));const site=await netlify('/sites/'+siteId);await netlify('/sites/'+siteId,{domain_aliases:(site.domain_aliases||[]).filter(h=>normalizeHostname(h)!==binding.hostname)},'PATCH');console.log(binding.hostname,'disabled');}
if(command==='reconcile'){
 for(const binding of await read('agent_report_domains','select=*&status=eq.live')){
  let eligible;try{eligible=await resolveAgentDomain(binding.hostname,{read,siteId});await dnsCheck(binding.hostname);}catch{eligible=null;}
  if(!eligible)await disable(binding);else console.log(binding.hostname,'live and eligible');
 }
}else{
 if(!validAgentHostname(host,{testOnly:host===TEST_HOST}))throw Error('Invalid or reserved agent hostname');
 const [existing]=await read('agent_report_domains','select=*&hostname=eq.'+encodeURIComponent(host));
 if(command==='disable'){if(!existing)throw Error('No binding');await disable(existing);}
 else if(command==='approve'){
  if(!process.argv.includes('--ownership-reviewed'))throw Error('Admin ownership review is required; a generic CNAME is not proof of account ownership');
  if(host===TEST_HOST)throw Error('The isolated platform test binding is provisioned separately; never create a production seat for it');
  if(!/^[0-9a-f-]{36}$/i.test(agentId||''))throw Error('Provide the agent UUID');
  if(existing&&existing.agent_id!==agentId)throw Error('Hostname already belongs to another agent; remove the old binding and repeat ownership review');
  const [agent]=await read('agents',`select=id,report_display_mode,report_subdomain&id=eq.${agentId}`);
  if(agent?.report_display_mode!=='subdomain'||normalizeHostname(agent.report_subdomain)!==host)throw Error('Saved onboarding preference does not match');
  await dnsCheck(host);
  const binding={hostname:host,agent_id:agentId,status:'pending_ssl',netlify_site_id:siteId,ownership_verified_at:stamp(),ownership_method:'admin_reviewed',tls_verified_at:null,test_only:false,updated_at:stamp()};
  if(existing)await db('agent_report_domains',binding,'PATCH','hostname=eq.'+host);else await db('agent_report_domains',binding);
  const site=await netlify('/sites/'+siteId);await netlify('/sites/'+siteId,{domain_aliases:[...new Set([...(site.domain_aliases||[]),host])]},'PATCH');
  try{await netlify('/sites/'+siteId+'/ssl/renew',{},'POST');}catch{await netlify('/sites/'+siteId+'/ssl',{},'POST');}
  console.log(host,'approved; awaiting HTTPS. Run activate after certificate provisioning.');
 }else if(command==='activate'){
  if(!existing||!existing.ownership_verified_at||existing.netlify_site_id!==siteId)throw Error('No approved hosting binding');
  await dnsCheck(host);const site=await netlify('/sites/'+siteId);if(!(site.domain_aliases||[]).includes(host))throw Error('Hostname is not bound to this site');
  // Fetch verifies the actual certificate and hostname; a pending portal may return 404.
  const tls=await fetch('https://'+host+'/',{redirect:'manual',signal:AbortSignal.timeout(20000)});if(tls.status>=500)throw Error('HTTPS service not ready');
  const proposed={...existing,status:'live',tls_verified_at:stamp()};
  const tenant=await resolveAgentDomain(host,{siteId,read:async(table,query)=>table==='agent_report_domains'?[proposed]:read(table,query)});if(!tenant)throw Error('Current seat or saved preference is ineligible');
  await db('agent_report_domains',{status:'live',tls_verified_at:proposed.tls_verified_at,updated_at:stamp()},'PATCH','hostname=eq.'+host);
  try{const r=await fetch('https://'+host+'/',{cache:'no-store',signal:AbortSignal.timeout(30000)});const html=await r.text();if(!r.ok||!html.includes(`data-agent-id="${existing.agent_id}"`))throw Error('Rendered identity check failed');console.log(host,'LIVE: HTTPS and expected agent verified');}
  catch(e){await db('agent_report_domains',{status:'error',updated_at:stamp()},'PATCH','hostname=eq.'+host);throw e;}
 }else throw Error('Use approve HOST AGENT_UUID --ownership-reviewed, activate HOST, disable HOST, or reconcile');
}
