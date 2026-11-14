import { getAllMarkets, getPosts } from '../../../lib/posts';
export function getStaticPaths() { return getAllMarkets().map(m => ({ params: { zip: m.zip }, props: { market: m } })); }
export function GET({ props }) {
  const m = props.market;
  return new Response(JSON.stringify({ zip: m.zip, name: m.name, url: m.url, posts: getPosts(m) }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
