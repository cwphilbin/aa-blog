import { getAllMarkets, getPosts, coverImage, getReportingMonth } from '../../lib/posts';
export function GET() {
  const markets = getAllMarkets().map(m => ({ zip: m.zip, name: m.name, url: m.url, posts: getPosts(m).map(p => ({
    slug: p.slug, id: p.id, title: p.title, date: p.date, month: p.month || p.date.slice(0, 7),
    summary: p.summary, label: p.monthlyReport?.label, preview: p.monthlyReport?.preview, source: p.monthlyReport?.source, videoUrl: p.videoUrl, slideImages: coverImage(p) ? [coverImage(p)] : [],
  })) }));
  return new Response(JSON.stringify({ reportingMonth: getReportingMonth(), markets }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
