import test from 'node:test';
import assert from 'node:assert/strict';
import { projectSeats, loadSeatDirectory, safeUrl } from '../src/server/seat-directory.mjs';
import { agentSchema, openingSentence } from '../src/lib/seat-agents.ts';
const county={id:'county-1',county:'Los Angeles',state:'CA',slug:'los-angeles-ca',is_sellable:true,seat_agent_id:'agent-123',subscription_status:'active'};
const profile={id:'agent-123',full_name:'Avery Example',brokerage:'Example Realty',headshot_url:'https://example.com/photo.jpg',website:'https://example.com',phone:'555-0100',email:'private@example.com',stripe_customer_id:'private-customer'};
const links=[{zip:'93536',county_id:'county-1'},{zip:'85032',county_id:'other'}];
test('current county seat overrides snapshots; canceled and unassigned seats cannot brand pages',()=>{
 const directory=projectSeats([county],[profile],links);assert.equal(directory.zips['93536'],'avery-example-agent-12');assert.equal(directory.zips['85032'],undefined);
 for(const change of [{subscription_status:'canceled'},{seat_agent_id:null},{is_sellable:false}])assert.equal(projectSeats([{...county,...change}],[profile],links).agents.length,0);
 assert.throws(()=>projectSeats([county],[],links),/no public agent/);
 assert(!JSON.stringify(directory).includes('private@'));assert(!JSON.stringify(directory).includes('private-customer'));
});
test('schema uses matching agent identity, public website and county geography',()=>{
 const agent=projectSeats([county],[profile],links).agents[0];const schema=agentSchema(agent);
 assert.equal(schema['@type'],'RealEstateAgent');assert.equal(schema.worksFor.name,'Example Realty');assert.equal(schema.sameAs[0],'https://example.com/');assert.equal(schema.areaServed[0].name,'Los Angeles County, CA');assert(schema.url.endsWith('/agents/'+agent.slug));assert.equal(schema.image,profile.headshot_url);
});
test('opening repeats existing headline figures; null figures never become zero',()=>{
 const agent=projectSeats([county],[profile],links).agents[0];
 const sentence=openingSentence(agent,{title:'Active listings: 155 in ZIP 93536'} as any);assert(sentence.includes('Avery Example'));assert(sentence.includes('155'));assert(!sentence.includes('0%'));
});
test('unsafe branding URLs are removed',()=>{for(const url of ['javascript:alert(1)','data:text/html,x','https://user:pass@example.com'])assert.equal(safeUrl(url),'');});
test('lookup failure fails build rather than publishing a false open county',async()=>{
 await assert.rejects(()=>loadSeatDirectory({SUPABASE_URL:'https://example.com',AA_SUPABASE_SECRET_KEY:'test-only'},async()=>new Response('',{status:503})),/lookup failed/);
});
