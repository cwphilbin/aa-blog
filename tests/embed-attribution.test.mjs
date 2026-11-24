import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../public/embed.js',import.meta.url),'utf8');
function frame(search){
 let mounted;const mount={id:'aa-reports',dataset:{agent:'fixture'},replaceChildren:f=>mounted=f};
 const iframe={style:{},contentWindow:{postMessage(){}},setAttribute(){},addEventListener(){}};
 const location={href:'https://reports.example.test/'+search,origin:'https://reports.example.test',protocol:'https:',search,hash:''};
 const window={addEventListener(){}};
 const document={currentScript:{src:'https://agentsautomated.com/embed.js'},querySelectorAll:()=>[mount],createElement:()=>iframe};
 runInNewContext(code,{window,document,location,URL,URLSearchParams});return new URL(mounted.src);
}
test('consumer embed forwards only the four UTM tags, retaining existing isolation and agent selection',()=>{
 const url=frame('?utm_source=youtube&utm_medium=shorts&utm_campaign=los-angeles-ca&utm_content=fixture&email=private%40example.invalid&other=ignore');
 for(const field of ['utm_source','utm_medium','utm_campaign','utm_content'])assert.ok(url.searchParams.get(field));
 assert.equal(url.searchParams.get('email'),null);assert.equal(url.searchParams.get('other'),null);
 assert.equal(url.searchParams.get('agent'),'fixture');assert.equal(url.searchParams.get('parentOrigin'),'https://reports.example.test');
});
test('invalid or absent tags never add other host-page parameters',()=>{
 const url=frame('?utm_source=%0Ayoutube&utm_content='+('x'.repeat(201))+'&private=ignore');
 assert.equal(url.searchParams.get('utm_content'),null);assert.equal(url.searchParams.get('utm_source'),null);assert.equal(url.searchParams.get('private'),null);
 assert.equal(frame('').searchParams.has('utm_source'),false);
});
