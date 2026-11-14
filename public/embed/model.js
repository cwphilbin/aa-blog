export const monthOf = post => /^(\d{4}-\d{2})/.exec(post.story?.month || post.month || post.date || '')?.[1] || '';
export function monthsFor(markets) { return [...new Set(markets.flatMap(m => m.posts.map(monthOf)).filter(Boolean))].sort().reverse(); }
export function readRoute(hash, months, fixedZip = '') {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  return { view: ['county','zip','report'].includes(p.get('view')) ? p.get('view') : fixedZip ? 'zip' : 'county',
    month: months.includes(p.get('month')) ? p.get('month') : months[0] || '',
    zip: /^\d{5}$/.test(p.get('zip') || '') ? p.get('zip') : fixedZip,
    post: p.get('post') || '', search: (p.get('search') || '').slice(0,80), page: Math.max(1, Math.min(10000, parseInt(p.get('page') || '1',10) || 1)) };
}
export function routeHash(route) { return new URLSearchParams(Object.entries(route).map(([k,v])=>[k,String(v)])).toString(); }
export function landingPage(markets, route) {
  const q = route.search.trim().toLowerCase();
  const cards = markets.map(m => ({ ...m, posts: m.posts.filter(p => monthOf(p) === route.month).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,1) }))
    .filter(m => m.posts.length && (!q || `${m.zip} ${m.name}`.toLowerCase().includes(q))).sort((a,b)=>a.zip.localeCompare(b.zip));
  const pages = Math.max(1,Math.ceil(cards.length/9)), page = Math.min(route.page,pages);
  return { cards: cards.slice((page-1)*9,page*9), total:cards.length, pages, page, videos: cards.filter(m=>m.posts[0].videoUrl).length };
}
export function neighboringMonths(posts, current) {
  const sorted = [...posts].sort((a,b)=>monthOf(b).localeCompare(monthOf(a)) || b.date.localeCompare(a.date));
  const nextMonth = [...new Set(sorted.map(monthOf))].sort().find(m=>m>monthOf(current));
  return { previous: sorted.find(p=>monthOf(p)<monthOf(current)), next:sorted.find(p=>monthOf(p)===nextMonth) };
}
