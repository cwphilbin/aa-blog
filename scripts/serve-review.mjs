import http from 'node:http';import {readFile,stat} from 'node:fs/promises';import {createReadStream} from 'node:fs';import {resolve,extname,sep} from 'node:path';
const root=resolve(process.argv[2]||'dist'),port=Number(process.argv[3]||4321),review=resolve(process.argv[4]||'review/seat-directory.json');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.xml':'application/xml','.mp4':'video/mp4'};
http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost');if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 let path;
 if(u.pathname==='/.netlify/functions/seat-agents')path=review;
 else{path=resolve(root,'.'+decodeURIComponent(u.pathname));if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);return res.end();}if((await stat(path)).isDirectory())path=resolve(path,'index.html');}
 const info=await stat(path),headers={'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};
 const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');let start=0,end=info.size-1;
 if(match){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;if(start>end){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end();}headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;}
 headers['Content-Length']=String(end-start+1);res.writeHead(match?206:200,headers);if(req.method==='HEAD')res.end();else createReadStream(path,{start,end}).pipe(res);
}catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`Review at http://localhost:${port}`));
