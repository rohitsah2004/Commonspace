import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

// Real provider adapter, route, parser, content validator and quota SQL. Network/auth/rendering boundaries are mocked.
const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'commonplace-clip-test-'));
const databasePath = join(directory, 'quota.sqlite');
const fixture = { owner:true, env:{}, calls:0, response:'ok', timeout:false, onFetch:null, requests:[], writes:[] };
function sql(statements) {
  const result = spawnSync('python3', ['-c', `import sqlite3,json,sys
input=json.load(sys.stdin)
con=sqlite3.connect(input['path'])
con.execute('CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY,window_start INTEGER NOT NULL,count INTEGER NOT NULL)')
results=[]
with con:
 for statement in input['statements']:
  cursor=con.execute(statement['sql'],statement['params'])
  rows=[dict(zip([c[0] for c in cursor.description],row)) for row in cursor.fetchall()] if cursor.description else []
  results.append({'results':rows})
print(json.dumps(results))
`,], {input:JSON.stringify({path:databasePath,statements}),encoding:'utf8'});
  if(result.status!==0) throw Error(result.stderr);
  return JSON.parse(result.stdout);
}
fixture.database = {
  prepare(query) { const statement={sql:query,params:[],bind(...params){statement.params=params;return statement;},async all(){return {results:query.includes('collections')?[{name:'Security'}]:[{tag:'network'},{tag:'commands'},{tag:'enumeration'},{tag:'AKIA'+'X'.repeat(16)}]};}};return statement; },
  async batch(statements) {
    assert(statements.every(s=>s.sql.startsWith('DELETE FROM rate_limits') || s.sql.startsWith('INSERT INTO rate_limits') || s.sql.startsWith('UPDATE rate_limits')),'Clip must only write quota counters');
    fixture.writes.push(...statements); return sql(statements);
  },
};
globalThis.clipFixture=fixture;
const mocks = new Map([
  [new URL('lib/server.ts',root).href, `export const database=()=>globalThis.clipFixture.database;export const isOwner=async()=>globalThis.clipFixture.owner;export const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});export const authorizeWrite=async request=>request.headers.get('origin')!==new URL(request.url).origin||!globalThis.clipFixture.owner?json({error:'Owner and same origin required.'},403):null;`],
  [new URL('app/chatgpt-auth.ts',root).href, `export const getChatGPTUser=async()=>globalThis.clipFixture.owner?{userId:'disposable-owner-id'}:null;`],
  [new URL('app/components/document-body.tsx',root).href, 'export const DocumentBody=()=>null;'],
  ['cloudflare:workers', 'export const env=globalThis.clipFixture.env;'],
]);
const urls = new Map();
const dataURL = source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
async function moduleURL(file) {
  const key = typeof file === 'string' ? file : file.href;
  if (mocks.has(key)) return dataURL(mocks.get(key));
  if (urls.has(key)) return urls.get(key);
  const work = (async()=> {
    let code = ts.transpileModule(await readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    for(const match of [...code.matchAll(/from ["']([^"']+)["']/g)]) {
      const spec=match[1];let target;
      if(mocks.has(spec))target=await moduleURL(spec);
      else if(spec.startsWith('.')) {
        let path=new URL(spec+'.ts',file);try{await access(path);}catch{path=new URL(spec+'.tsx',file);}
        target=await moduleURL(path);
      } else target=import.meta.resolve(spec);
      code=code.replace(match[0],'from '+JSON.stringify(target));
    }
    return dataURL(code);
  })();urls.set(key,work);return work;
}

const originalFetch=globalThis.fetch, originalTimeout=globalThis.setTimeout;
const page='# Clip fixture\n\n'+('Readable original example text for testing only. '.repeat(20));
fixture.mode='ok';fixture.redirects=0;fixture.dnsPrivate=false;
try {
 globalThis.fetch=async(url,options={})=>{
  const target=String(url);assert(!target.includes('api.openai.com'));
  assert.equal(options.redirect,'manual');
  if(target.startsWith('https://cloudflare-dns.com/')) {
   assert(!options.headers.Authorization);return Response.json({Status:0,Answer:[{type:1,data:fixture.dnsPrivate?'10.0.0.1':'93.184.216.34'}]});
  }
  fixture.calls++;fixture.requests.push({url:target,options});assert(!options.headers.Authorization);assert(!options.headers.Cookie);
  fixture.onFetch?.();
  if(fixture.mode==='timeout'||options.signal.aborted)return await new Promise((resolve,reject)=>{const fail=()=>reject(new DOMException('private upstream details','AbortError'));if(options.signal.aborted)fail();else options.signal.addEventListener('abort',fail,{once:true});});
  if(fixture.mode==='redirect-private')return new Response(null,{status:301,headers:{Location:'https://127.0.0.1/private'}});
  if(fixture.mode==='redirect'){fixture.mode='ok';return new Response(null,{status:301,headers:{Location:'/final'}});}
  if(fixture.mode==='loop')return new Response(null,{status:302,headers:{Location:'/again'}});
  if(fixture.mode==='404')return new Response(null,{status:404});
  if(fixture.mode==='blocked')return new Response(null,{status:403});
  if(fixture.mode==='pdf')return new Response('pdf',{headers:{'content-type':'application/pdf'}});
  if(fixture.mode==='huge-header')return new Response(page,{headers:{'content-type':'text/plain','content-length':'2000001'}});
  if(fixture.mode==='huge-stream')return new Response('x'.repeat(2000001),{headers:{'content-type':'text/plain'}});
  if(fixture.mode==='spa')return new Response('JavaScript required',{headers:{'content-type':'text/plain'}});
  return new Response(page,{headers:{'content-type':'text/markdown; charset=utf-8'}});
 };
 globalThis.setTimeout=(fn,ms,...args)=>fixture.mode==='timeout'&&ms===15000?originalTimeout(fn,0,...args):originalTimeout(fn,ms,...args);
 const route=await import(await moduleURL(new URL('app/api/clip/route.ts',root)));
 const fetcher=await import(await moduleURL(new URL('lib/clip-fetch.ts',root)));
 const content=await import(await moduleURL(new URL('lib/clip-content.ts',root)));
 const quota=await import(await moduleURL(new URL('lib/clip-quota.ts',root)));
 const protect=await import(await moduleURL(new URL('lib/assist-protection.ts',root)));
 const post=(value,origin='http://127.0.0.1:5173',signal)=>route.POST(new Request('http://127.0.0.1:5173/api/clip',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(value),signal}));
 const input={url:'https://example.org/notes'};
 const count=()=>sql([{sql:'SELECT sum(count) AS n FROM rate_limits',params:[]}])[0].results[0].n||0;
 fixture.owner=false;assert.equal((await post(input)).status,403);fixture.owner=true;assert.equal((await post(input,'https://untrusted.invalid')).status,403);
 for(const url of ['https://127.0.0.1','http://example.org','https://localhost','https://user:pass@example.org','https://example.org:8443','https://0x7f000001','https://[::1]','https://foo.internal','https://foo.localdomain','https://foo.corp','not a URL']) {assert.throws(()=>fetcher.checkClipURL(url));assert.equal((await post({url})).status,400);}
 assert.equal(fixture.calls,0);assert.equal(count(),0);
 for(const value of [{url:123},{url:input.url,extra:true},{url:'x'.repeat(20001)},[]])assert.equal((await post(value)).status,400);
 for(const [url,expected] of [['https://github.com/a/b/blob/main/docs/README.md','https://raw.githubusercontent.com/a/b/main/docs/README.md'],['https://github.com/a/b','https://raw.githubusercontent.com/a/b/HEAD/README.md'],['https://gist.github.com/a/123','https://gist.githubusercontent.com/a/123/raw']]) {
  assert.equal(fetcher.rewriteClipGitHub(fetcher.checkClipURL(url)).href,expected);
  const response=await post({url});assert.equal(response.status,200);const data=await response.json();assert.equal(data.sourceUrl,expected);assert(data.text.startsWith('SOURCE PAGE'));assert.equal(fixture.requests.at(-1).url,expected);assert.equal(response.headers.get('Cache-Control'),'no-store');
 }
 let before=count();fixture.mode='redirect';let r=await post(input);assert.equal(r.status,200);assert.equal((await r.json()).sourceUrl,'https://example.org/final');assert.equal(count(),before+1);
 for(const [mode,status] of [['redirect-private',400],['loop',502],['404',404],['blocked',502],['pdf',415],['huge-header',413],['huge-stream',413],['spa',422]]) {
  fixture.mode=mode;before=count();r=await post(input);assert.equal(r.status,status,mode);assert.equal(count(),before,mode+' refund');assert(!(await r.text()).includes('private upstream details'));
 }
 fixture.mode='ok';fixture.dnsPrivate=true;before=count();let calls=fixture.calls;assert.equal((await post(input)).status,502);assert.equal(fixture.calls,calls);assert.equal(count(),before);fixture.dnsPrivate=false;
 fixture.mode='timeout';before=count();assert.equal((await post(input)).status,504);assert.equal(count(),before);
 fixture.mode='ok';const controller=new AbortController();fixture.onFetch=()=>controller.abort();before=count();assert.equal((await post(input,undefined,controller.signal)).status,504);assert.equal(count(),before);fixture.onFetch=null;
 const code='```bash\necho "&& < > $(id) | cat"\n\n\nkeep blanks\n```';
 const finished=content.finishClip('Intro\n'+code+'\nend');assert(finished.text.includes(code));assert(!finished.truncated);protect.protectLiterals(finished.text);
 const long='Intro text '.repeat(50)+'\n'+code+'\n'+('long line '.repeat(3000));const trimmed=content.finishClip(long);assert(trimmed.truncated);assert(trimmed.text.includes(code));assert(trimmed.text.length<=18000);protect.protectLiterals(trimmed.text);
 const hugeBlock='Intro '.repeat(70)+'\n```bash\n'+('command '.repeat(3000))+'\n```';const omitted=content.finishClip(hugeBlock);assert(omitted.truncated);assert(!omitted.text.includes('command'));protect.protectLiterals(omitted.text);
 const closed=content.finishClip('Intro\n~~~~bash\necho exact');assert(closed.text.endsWith('~~~~'));protect.protectLiterals(closed.text);
 const wrapped=content.clipInput({text:'text '.repeat(4000),title:'Example',sourceUrl:'https://example.org/'+('a'.repeat(2000)),truncated:false});assert(wrapped.text.length<=20000);
 const attribution=content.appendClipAttribution([],{title:'[x](javascript:bad)<script>',sourceUrl:'https://example.org/source'});assert.equal(attribution[0].children[1].href,'https://example.org/source');assert.equal(attribution[0].children[1].children[0].text,'[x](javascript:bad)<script>');assert.throws(()=>content.appendClipAttribution([],{title:'bad',sourceUrl:'javascript:alert(1)'}));
 sql([{sql:'DELETE FROM rate_limits',params:[]}]);fixture.calls=0;
 for(let i=0;i<20;i++)assert.equal((await post(input)).status,200);
 const denied=await post(input);assert.equal(denied.status,429);assert(Number(denied.headers.get('Retry-After'))>0);assert.equal(fixture.calls,20);
 sql([{sql:'DELETE FROM rate_limits',params:[]}]);
 const outcomes=await Promise.all(Array.from({length:25},()=>quota.claimClipQuota(fixture.database,'parallel-owner')));assert.equal(outcomes.filter(Boolean).length,20);
 const at=Date.UTC(2026,10,18,23,59,59);assert(await quota.claimClipQuota(fixture.database,'midnight-owner',at));await quota.refundClipQuota(fixture.database,'midnight-owner',at);assert(await quota.claimClipQuota(fixture.database,'midnight-owner',at+86400000));
 const bytes=await readFile(databasePath);assert(!bytes.includes(Buffer.from('Readable original')));
 console.log('PASS: clip owner/origin guards, input/DNS/redirect/type/size limits, GitHub rewrites, quota/refunds, abort/deadline, literal-safe truncation and client attribution.');
} finally {globalThis.fetch=originalFetch;globalThis.setTimeout=originalTimeout;delete globalThis.clipFixture;await rm(directory,{recursive:true,force:true});}
