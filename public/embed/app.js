import {initSurface} from './report-kit/controller.js';
const query=new URLSearchParams(location.search),root=document.querySelector('#app');
async function json(url){const r=await fetch(url,{credentials:'omit'});if(!r.ok)throw Error('Reports are temporarily unavailable.');return r.json();}
try{
 const slug=query.get('agent'),zip=query.get('zip');
 const [directory,catalog,offeredZips]=await Promise.all([json('https://aa-blog.netlify.app/.netlify/functions/seat-agents'+(slug?'?agent='+encodeURIComponent(slug):'')),json('/market/reports.json'),json('/embed/offered-zips.json')]);
 let agent,markets=catalog.markets;
 if(slug){agent=directory.agents.find(a=>a.slug===slug||a.id===slug.toLowerCase());if(!agent)throw Error('This agent does not currently hold an active county seat.');const zips=new Set(agent.counties.flatMap(c=>c.zips));markets=markets.filter(m=>zips.has(m.zip));for(const c of agent.counties)for(const z of c.zips)if(!markets.some(m=>m.zip===z))markets.push({zip:z,name:c.name+' County, '+c.state,posts:[]});}
 else if(/^\d{5}$/.test(zip||'')){markets=markets.filter(m=>m.zip===zip);agent=directory.agents.find(a=>a.slug===directory.zips[zip]);}
 else throw Error('Choose an agent or ZIP to view reports.');
 root.className='aa-design';initSurface(root,{embedded:true,page:'collection',agent,markets,offeredZips:slug?offeredZips.filter(m=>agent.counties.some(c=>c.zips.includes(m.zip))):offeredZips,months:[catalog.reportingMonth],mockSignup:false,parentOrigin:query.get('parentOrigin'),links:{agent:agent?'/agents/'+agent.slug:'/market',home:'/market'},loadReport:zip=>json('/market/'+zip+'/report-data.json')});
}catch(error){const p=document.createElement('p');p.textContent=error.message;root.replaceChildren(p);}
