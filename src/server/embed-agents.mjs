import {loadSeatDirectory} from './seat-directory.mjs';
import {restReader,resolveAgentDomain,TEST_HOST} from './agent-domains.mjs';
export function findEmbedAgent(agents,identifier){
 const value=String(identifier||'');
 return agents.find(a=>a.id?.toLowerCase()===value.toLowerCase()||a.slug===value);
}
export function directoryForAgent(agent){
 return agent?{agents:[agent],zips:Object.fromEntries(agent.counties.flatMap(c=>c.zips).map(zip=>[zip,agent.slug]))}:{agents:[],zips:{}};
}
export async function loadEmbedDirectory(identifier,{env=process.env,request=fetch,siteId=env.SITE_ID,loadDirectory=loadSeatDirectory,resolveTest=resolveAgentDomain}={}){
 if(!/^[a-z0-9-]{1,160}$/i.test(identifier||''))return directoryForAgent(null);
 const directory=await loadDirectory(env,request),agent=findEmbedAgent(directory.agents,identifier);
 if(agent)return directoryForAgent(agent);
 // The approved expiring pilot is opt-in by exact UUID/slug lookup. It never
 // enters the normal seat directory or changes canonical production attribution.
 const test=await resolveTest(TEST_HOST,{read:restReader(env,request),siteId});
 return directoryForAgent(test&&findEmbedAgent([test.agent],identifier));
}
