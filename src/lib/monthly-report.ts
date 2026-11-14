import { moneyText } from '../../public/embed/money.js';
export interface MonthlyReport {
  source: 'GenerateZipScript'; sourceKey: string; packageVersion: string;
  month: string; label: string; headline: string; tldr: string; so_what?: string; preview: boolean;
  sections: { title: string; imageUrl?: string; alt?: string; text: string; headline?: string; sourceUrl?: string }[];
}
const order=['median_sales_price','median_price_per_sqft','active_listings','price_reductions','days_on_market','homes_sold','at_or_above_asking','list_vs_sold','what_sold','local_happenings'];
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
export function publicUrl(value: unknown): string {
  if(typeof value!=='string')return '';
  try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search ? u.href : '';}catch{return '';}
}
export function parseMonthlyReport(raw: unknown, zip: string, sourceKey: string, preview=false): MonthlyReport | undefined {
  try {
    const r=raw as any;
    if(r.schemaVersion!==1||r.sourceType!=='craftmypdf'||r.status!=='ready'||r.zip!==zip||(!preview&&(r.privateArtifacts||r.reviewSetId)))return;
    if(!Array.isArray(r.pages)||!Array.isArray(r.narration)||r.pages.length!==r.narration.length||!r.packageVersion)return;
    const match=/^([A-Za-z]+) (\d{4})$/.exec(r.contentLabel||'');if(!match||!months.includes(match[1]))return;
    const month=`${match[2]}-${String(months.indexOf(match[1])+1).padStart(2,'0')}`;
    const cover=r.pages.find((p:any)=>p.pageNumber===1);
    const headline=r.hook||cover?.pageText?.split('\n').find((s:string)=>s.trim());if(typeof headline!=='string'||!headline.trim())return;
    const last=Math.max(...r.pages.map((p:any)=>p.pageNumber));
    const selected=r.narration.filter((b:any)=>b.pageNumber>2&&b.pageNumber<last&&!b.dataUnavailable&&typeof b.text==='string'&&b.text.trim()&&!/unavailable/i.test(b.text));
    if(['aws-editorial-v2','coherent-deck-v1'].includes(r.narrationStyle))selected.sort((a:any,b:any)=>order.indexOf(a.role)-order.indexOf(b.role));
    const sections=[];
    for(const beat of selected){
      const p=r.pages.find((p:any)=>p.pageNumber===beat.pageNumber);if(!p||p.dataUnavailable)continue;
      // Intro/CTA and presentation branding never enter the article body.
      if(/agents? can claim|claim this (?:territory|county)/i.test(beat.text))continue;
      if(beat.role==='local_happenings'&&r.localHappenings){const n=r.localHappenings;if(typeof n.body!=='string'||typeof n.headline!=='string')return;sections.push({title:'Local happenings',headline:moneyText(n.headline),text:moneyText(n.body),sourceUrl:publicUrl(n.sourceUrl)});continue;}
      const imageUrl=publicUrl(p.chartImageUrl||p.imageUrl);
      if(!imageUrl||!imageUrl.startsWith(`https://aa-zip-metrics-prod.s3.us-east-2.amazonaws.com/reports/${r.month}/${zip}/page-`))return;
      sections.push({title:moneyText(r.chartTakeaways?.[String(beat.pageNumber)]||p.title||'Market figures'),imageUrl,alt:p.title||'Market chart',text:moneyText(beat.text)});
    }
    if(!sections.length)return;
    return {source:'GenerateZipScript',sourceKey,packageVersion:r.packageVersion,month,label:r.contentLabel,headline:moneyText(headline),tldr:moneyText(r.tldr||''),...(typeof r.so_what==='string'&&r.so_what.trim()?{so_what:r.so_what}:{}),sections,preview};
  }catch{return;}
}
export function reportPost(report: MonthlyReport, videoUrl='') {
  return {id:`${report.month}-market-update`,slug:`${months[Number(report.month.slice(5))-1].toLowerCase()}-${report.month.slice(0,4)}-market-update`,title:report.headline,date:report.month+'-01',month:report.month,summary:report.tldr,videoUrl,slideImages:report.sections.flatMap(s=>s.imageUrl?[s.imageUrl]:[]).slice(0,1),bodyHtml:'',metrics:{medianPrice:null,yoyChange:null,inventory:null,daysOnMarket:null,newListings:null,pricePerSqft:null},monthlyReport:report};
}
