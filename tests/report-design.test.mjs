import test from 'node:test';import assert from 'node:assert/strict';
import {renderReport,renderCollection,safeUrl} from '../public/embed/report-kit/render.js';
import {stateFromHash,hashFor,searchMarkets} from '../public/embed/report-kit/controller.js';
const post={slug:'october-2026-market-update',title:'Prices fell 4.0%.',date:'2026-10-01',month:'2026-10',summary:'Published figures.',videoUrl:'media/video.mp4',monthlyReport:{month:'2026-10',label:'October 2026',headline:'Prices fell 4.0%.',tldr:'Published figures.',sections:[{title:'Prices',text:'The gap was $-179,000.',imageUrl:'media/chart.png'}]}};
const market={zip:'93536',name:'Lancaster, CA',posts:[post]};
test('one renderer produces the report markup for embed, market and author views',()=>{const props={market,post,agent:{name:'Test Agent',brokerage:'Test Group'},links:{}};const html=renderReport(props);assert.equal(html,renderReport(props));assert.match(html,/-\$179K/);assert.match(html,/aa-signup-row/);assert.doesNotMatch(html,/Own a home, or thinking of buying or selling|Get this report every month|Get next month’s report/);assert.doesNotMatch(html,/review-banner|fixture|claim this|monthly-section/);});
test('report input is escaped and unsafe URL protocols are discarded',()=>{const p=structuredClone(post);p.monthlyReport.headline='<script>alert(1)</script>';const html=renderReport({market,post:p,agent:null});assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.equal(safeUrl('javascript:alert(1)'),'');assert.equal(safeUrl('media/chart.png'),'media/chart.png');});
test('typeahead matches ZIP or place tokens; hash retains multi-select and accordion state',()=>{const data=[market,{zip:'90001',name:'Los Angeles County, CA',posts:[]}];assert.equal(searchMarkets(data,'lanc 935').length,1);const state={view:'report',zip:'93536',post:post.slug,zips:['93536','90001'],search:'',open:['2026-10']};assert.deepEqual(stateFromHash(hashFor(state)),state);});
test('latest month starts expanded, older month collapsed; no invented archive cards',()=>{const html=renderCollection({markets:[market],months:['2026-10','2026-09'],links:{}},{zips:[],search:'',open:null});assert.match(html,/aria-expanded="true" aria-controls="month-2026-10"/);assert.match(html,/aria-expanded="false" aria-controls="month-2026-09"/);assert.equal((html.match(/class="aa-report-card"/g)||[]).length,1);assert.ok(!html.includes('summary'))});
test('requested signup placement, consent text and report CTA use only selected agent values',()=>{const a={name:'Test Agent',brokerage:'Test Group',cta_type:'Call',cta_label:'Call colby test test',cta_value:'9162128640'};const html=renderReport({market,post,agent:a,links:{full:'report.html'}});assert.match(html,/class="aa-main aa-report"[^>]*><section class="aa-signup"/);assert.match(html,/href="tel:9162128640">Call colby test test/);assert.doesNotMatch(html,/type="checkbox"|View full report|See full report/);assert.match(html,/I agree to monthly emails from Agents Automated and the local report agent. Unsubscribe anytime./);const collection=renderCollection({markets:[market],agent:a,links:{}},{zips:[],search:'',open:null});assert.match(collection,/class="aa-main aa-collection"><section class="aa-signup"/);});
test('pipeline so_what follows TL;DR and precedes evidence, with no invented fallback',()=>{const p=structuredClone(post);assert.ok(!renderReport({market,post:p}).includes('aa-so-what'));p.monthlyReport.so_what=p.monthlyReport.sections[0].text;const html=renderReport({market,post:p});assert.ok(html.indexOf('aa-deck')<html.indexOf('aa-so-what'));assert.ok(html.indexOf('aa-so-what')<html.indexOf('aa-film'));assert.ok(html.indexOf('aa-so-what')<html.indexOf('aa-narrative'));});


test('all report surfaces reject provider/historical wording and named headline regressions',()=>{
 const names={name_1:'Lancaster',name_2:'Quartz Hill',full:'Lancaster, Quartz Hill'};
 const p=structuredClone(post);p.title=p.monthlyReport.headline='Lancaster & Quartz Hill (93536) home sales fell 14.3% vs last year';p.monthlyReport.neighborhoodNames=names;p.monthlyReport.contentStandardVersion='content-standard-2026-11-24-periods-v4';
 assert.doesNotThrow(()=>renderReport({market,post:p}));
 for(const word of ['Redfin','historical']){const bad=structuredClone(p);bad.monthlyReport.sections[0].text='The '+word+' market report.';assert.throws(()=>renderReport({market,post:bad}),/CS04\/CS07/);}
 for(const headline of ['Lancaster (93536) sales down 14.3% YoY; price wisely','Lancaster (93536) sales fell 14.3%; vs last year','x'.repeat(61)]){const bad=structuredClone(p);bad.title=bad.monthlyReport.headline=headline;assert.throws(()=>renderReport({market,post:bad}),/CS08/);}
});


test('new period policy uses both names and source date; retained v3 reports keep archived wording',()=>{
 const p=structuredClone(post);p.monthlyReport.neighborhoodNames={name_1:'Lancaster',name_2:'Quartz Hill',full:'Lancaster, Quartz Hill'};
 p.monthlyReport.contentStandardVersion='content-standard-2026-11-24-periods-v4';
 p.title=p.monthlyReport.headline='Lancaster & Quartz Hill (93536) home sales fell 14.3% vs last year';
 const html=renderReport({market,post:p});assert.ok(html.includes('*3 months ending October 2026'));assert.ok(!html.includes('rolling average'));
 p.monthlyReport.headline='Lancaster (93536) home sales fell 14.3% vs last year';assert.throws(()=>renderReport({market,post:p}),/CS08/);
 p.monthlyReport.contentStandardVersion='content-standard-2026-11-17-v3';const archived=renderReport({market,post:p});assert.ok(archived.includes('*3-month rolling average'));delete p.monthlyReport.contentStandardVersion;assert.equal(renderReport({market,post:p}),archived);
});
