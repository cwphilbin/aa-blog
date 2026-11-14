import {loadEmbedDirectory} from '../../src/server/embed-agents.mjs';
import { loadSeatDirectory } from '../../src/server/seat-directory.mjs';
export default async function handler(request, context) {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  try {
    const identifier=new URL(request.url).searchParams.get('agent');
    const directory=identifier===null?await loadSeatDirectory():await loadEmbedDirectory(identifier,{siteId:context?.site?.id||process.env.SITE_ID});
    return new Response(JSON.stringify(directory), { headers });
  }
  catch { return new Response(JSON.stringify({ error: 'Current agent information is temporarily unavailable.' }), { status: 503, headers }); }
}
