import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMonthlyReport, reportPost } from '../src/lib/monthly-report.ts';
import { renderReport } from '../public/embed/report-kit/render.js';
import { domainPage } from '../src/server/agent-domain-page.mjs';
import { storedNeighborhoodNames, neighborhoodLabel } from '../public/embed/neighborhoods.js';

const names = {name_1:'Lancaster',name_2:'Quartz Hill',full:'Lancaster, Quartz Hill, West Lancaster'};
const fixture=JSON.parse(readFileSync(new URL('../review/monthly-reports.json',import.meta.url),'utf8'))[0];

test('monthly report carries stored names, source-authored title and stable URL slug', () => {
  const raw=structuredClone(fixture.report);
  raw.neighborhoodNames=names;
  raw.title='Lancaster & Quartz Hill (93536) home values fell 6% vs last year';
  raw.hook=raw.title+'.';
  raw.tldr='In Lancaster & Quartz Hill (93536), '+raw.tldr;
  const parsed=parseMonthlyReport(raw,'93536',fixture.sourceKey,true)!;
  assert.deepEqual(parsed.neighborhoodNames,names);
  assert.equal(parsed.headline,raw.title);
  const post=reportPost(parsed);
  assert.equal(post.slug,'october-2026-market-update');
  const market={zip:'93536',name:'Lancaster & Quartz Hill',url:'https://agentsautomated.com/market/93536',posts:[post]};
  const content=renderReport({market,post,agent:null});
  assert.match(content,/Lancaster &amp; Quartz Hill \(93536\)/);
  assert.ok(content.includes(raw.title.replaceAll('&','&amp;')));
});

test('subdomain title and metadata use report copy while retaining the canonical URL', () => {
  const post={title:'Lancaster (93536) home values fell 6% vs last year',summary:'In Lancaster & Quartz Hill (93536), available homes declined.',slug:'october-2026-market-update'};
  const agent={id:'review',name:'Review agent',brokerage:'',photoUrl:'',counties:[{name:'Los Angeles',state:'CA',zips:['93536']}]};
  const page=domainPage({agent,hostname:'reports.example.test',testOnly:true,zips:new Set(['93536'])},{market:{zip:'93536',name:'Lancaster & Quartz Hill',posts:[]},post});
  assert.ok(page.includes('<title>'+post.title+'</title>'));
  assert.match(page,/name="description" content="In Lancaster &amp; Quartz Hill \(93536\)/);
  assert.match(page,/property="og:title"/);
  assert.match(page,/name="twitter:description"/);
  assert.match(page,/canonical" href="https:\/\/agentsautomated.com\/market\/93536\/october-2026-market-update/);
});

test('labels preserve leading-zero ZIPs and do not infer or trust malformed names', () => {
  assert.equal(neighborhoodLabel('01701',{name_1:'Framingham',name_2:'',full:'Framingham'}),'Framingham (01701)');
  assert.equal(storedNeighborhoodNames({cityName:'unverified'}),undefined);
  assert.throws(()=>storedNeighborhoodNames({neighborhoodNames:{name_1:'Bad\nname',name_2:'',full:'Bad'}}));
});

test('headline caps are 75 only for the five approved ZIPs and percentages keep valid grouping', async () => {
  const {assertHeadline}=await import('../public/embed/report-kit/render.js');
  for(const zip of ['30313','30314','33617','92648','98101','90004','93536','30312']){
    const limit=['30313','30314','33617','92648','98101'].includes(zip)?75:65;
    for(const size of [limit,limit+1]){
      const tail='home sales rose 9% vs last year';
      const name='A'.repeat(size-` (${zip}) ${tail}`.length);
      const run=()=>assertHeadline(`${name} (${zip}) ${tail}`,zip,{name_1:name,name_2:'',full:name});
      if(size===limit)assert.doesNotThrow(run);else assert.throws(run,/CS08/);
    }
  }
  for(const pct of ['1,569.2','1,900','12,345,678.9'])assert.doesNotThrow(()=>assertHeadline(`Speonk (11972) days on market rose ${pct}% vs last year`,'11972',{name_1:'Speonk',name_2:'',full:'Speonk'}));
  for(const pct of ['1,56.2','19,00','1,,900','+1,900','-1,900'])assert.throws(()=>assertHeadline(`Speonk (11972) days on market rose ${pct}% vs last year`,'11972',{name_1:'Speonk',name_2:'',full:'Speonk'}),/CS08/);
});
