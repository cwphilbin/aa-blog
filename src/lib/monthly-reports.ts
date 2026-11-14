import { GetObjectCommand, ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';
import { readFile } from 'node:fs/promises';
import type { MarketFile } from '../types';
import { parseMonthlyReport, reportPost, publicUrl } from './monthly-report.ts';
import { mapWithConcurrency } from './concurrency.ts';
const Bucket='aa-zip-metrics-prod';
/** Feed metadata preserves routes only. Article bodies exclusively use PDF narration packages. */
export async function attachMonthlyReports(markets:MarketFile[],s3:S3Client){
  const previous=new Map(markets.map(m=>[m.zip,m.posts]));
  for(const m of markets){m.legacySlugs=m.posts.map(p=>p.slug);m.posts=[];}
  const keys:string[]=[];let token:string|undefined;
  do{const page=await s3.send(new ListObjectsV2Command({Bucket,Prefix:'reports/',ContinuationToken:token}));for(const o of page.Contents||[])if(o.Key&&/^reports\/\d{4}-\d{2}\/\d{5}\/narration\.json$/.test(o.Key))keys.push(o.Key);token=page.IsTruncated?page.NextContinuationToken:undefined;}while(token);
  await mapWithConcurrency(keys,8,async key=>{
    const zip=key.split('/')[2];const result=await s3.send(new GetObjectCommand({Bucket,Key:key}));
    let raw;try{raw=JSON.parse(await result.Body!.transformToString());}catch{console.warn(`[monthly] Malformed narration package for ZIP ${zip}; no fallback.`);return;}
    const report=parseMonthlyReport(raw,zip,key);if(!report){console.warn(`[monthly] Unusable narration package for ZIP ${zip}; no fallback.`);return;}
    let market=markets.find(m=>m.zip===zip);
    if(!market){market={zip,name:`ZIP ${zip}`,url:`https://agentsautomated.com/market/${zip}`,territoryCode:'',updatedAt:report.month+'-01',agent:{} as MarketFile['agent'],posts:[],legacySlugs:[]};markets.push(market);}
    // Only reuse a published long-form video when its monthly article identifies this PDF package.
    const matching=previous.get(zip)?.find(p=>p.date.startsWith(report.month)&&p.bodyHtml.includes('/reports/')&&report.sections.some(s=>s.imageUrl&&p.bodyHtml.includes(s.imageUrl)));
    market.posts.push(reportPost(report,publicUrl(matching?.videoUrl)));
  });
  if(process.env.MONTHLY_REVIEW_FILE){
    if(process.env.NETLIFY)throw Error('Private monthly review content cannot be deployed');
    const fixtures=JSON.parse(await readFile(process.env.MONTHLY_REVIEW_FILE,'utf8'));
    for(const fixture of fixtures){
      const market=markets.find(m=>m.zip===fixture.report.zip);if(!market)throw Error('Review ZIP has no route');
      const report=parseMonthlyReport(fixture.report,market.zip,fixture.sourceKey,true);if(!report)throw Error('Invalid monthly review fixture');
      if(!/^\/review-assets\/\d{5}-long-form\.mp4$/.test(fixture.videoUrl))throw Error('Review video must be local');
      market.posts=market.posts.filter(p=>p.month!==report.month);market.posts.push(reportPost(report,fixture.videoUrl));
    }
  }
  console.info(`[monthly] ${markets.reduce((n,m)=>n+m.posts.length,0)} PDF-narration posts; ${markets.filter(m=>!m.posts.length).length} ZIPs awaiting publication. Legacy content disabled.`);
}
