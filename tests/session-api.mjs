import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

// Real provider adapter, route, parser, content validator and quota SQL. Network/auth/rendering boundaries are mocked.
const root = new URL('../', import.meta.url);
const directory = await mkdtemp(join(tmpdir(), 'commonplace-session-test-'));
const databasePath = join(directory, 'quota.sqlite');
const fixture = { owner:true, env:{}, calls:0, response:'ok', timeout:false, onFetch:null, requests:[], writes:[] };
const migration = await readFile(new URL('drizzle/0004_keen_jigsaw.sql',root),'utf8');
function sql(statements) {
 const r=spawnSync('python3',['-c',`import sqlite3,json,sys
v=json.load(sys.stdin);c=sqlite3.connect(v['path']);c.execute('PRAGMA foreign_keys=ON')
if not c.execute("SELECT 1 FROM sqlite_master WHERE name='sessions'").fetchone(): c.executescript(v['migration'])
out=[]
with c:
 for s in v['statements']:
  q=c.execute(s['sql'],s['params']);rows=[dict(zip([x[0] for x in q.description],r)) for r in q.fetchall()] if q.description else []
  out.append({'results':rows})
print(json.dumps(out))`],{input:JSON.stringify({path:databasePath,migration,statements}),encoding:'utf8'});
 if(r.status!==0)throw Error(r.stderr);return JSON.parse(r.stdout);
}
fixture.user='owner-a';fixture.fail=false;
fixture.database={prepare(query){
 assert(query.includes('owner_id=?') || query.startsWith('INSERT INTO sessions'),'Queries must be owner-scoped');
 const s={sql:query,params:[],bind(...params){s.params=params;return s;},async first(){if(fixture.fail)throw Error('PRIVATE_DB_ERROR');return sql([s])[0].results[0]||null;},async all(){if(fixture.fail)throw Error('PRIVATE_DB_ERROR');return sql([s])[0];},async run(){if(fixture.fail)throw Error('PRIVATE_DB_ERROR');return sql([s])[0];}};return s;
}};
globalThis.sessionFixture=fixture;
const mocks = new Map([
  [new URL('lib/server.ts',root).href, `export const database=()=>globalThis.sessionFixture.database;export const isOwner=async()=>globalThis.sessionFixture.owner;export const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});export const authorizeWrite=async request=>request.headers.get('origin')!==new URL(request.url).origin||!globalThis.sessionFixture.owner?json({error:'Owner and same origin required.'},403):null;`],
  [new URL('app/chatgpt-auth.ts',root).href, `export const getChatGPTUser=async()=>globalThis.sessionFixture.owner?{userId:globalThis.sessionFixture.user}:null;`],
  [new URL('app/components/document-body.tsx',root).href, 'export const DocumentBody=()=>null;'],
  ['cloudflare:workers', 'export const env=globalThis.sessionFixture.env;'],
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

try {
 const list=await import(await moduleURL(new URL('app/api/sessions/route.ts',root)));
 const single=await import(await moduleURL(new URL('app/api/sessions/[id]/route.ts',root)));
 const entries=await import(await moduleURL(new URL('app/api/sessions/[id]/entries/route.ts',root)));
 const req=(method,value,origin='http://127.0.0.1:5173')=>new Request('http://127.0.0.1:5173/api/sessions',{method,headers:{Origin:origin},...(value===undefined?{}:{body:JSON.stringify(value)})});
 const context=id=>({params:Promise.resolve({id})});
 const value={name:'HTB - Lame',platform:'HTB',difficulty:'beginner',status:'active'};
 fixture.owner=false;assert.equal((await list.GET(req('GET'))).status,403);assert.equal((await list.POST(req('POST',value))).status,403);fixture.owner=true;
 assert.equal((await list.POST(req('POST',value,'https://evil.invalid'))).status,403);
 for(const patch of [{name:''},{platform:'x'.repeat(101)},{difficulty:['beginner']},{status:['active']},{unexpected:true}])assert.equal((await list.POST(req('POST',{...value,...patch}))).status,400);
 const response=await list.POST(req('POST',value));assert.equal(response.status,201);const {session}=await response.json();const ctx=context(session.id);
 assert.equal((await list.GET(req('GET'))).headers.get('Cache-Control'),'no-store');
 const literal='  echo "&& | $(id) < >"\nC:\\Users\\test\n``` inside\n  ';
 const added=await entries.POST(req('POST',{type:'command',content:literal,phase:'recon'}),ctx);assert.equal(added.status,201);const {entry}=await added.json();assert.equal(entry.content,literal);
 for(const patch of [{content:'x'.repeat(20001)},{content:''},{type:'bad'},{phase:'bad'},{owner_id:'owner-b'}])assert.equal((await entries.POST(req('POST',{type:'note',content:'text',...patch}),ctx)).status,400);
 const changed=await entries.PATCH(req('PATCH',{id:entry.id,content:literal+'\nnew',phase:'foothold'}),ctx);assert.equal(changed.status,200);assert.equal((await changed.json()).entry.created_at,entry.created_at);
 fixture.user='owner-b';assert.equal((await single.GET(req('GET'),ctx)).status,404);assert.equal((await single.PATCH(req('PATCH',{status:'done'}),ctx)).status,404);assert.equal((await single.DELETE(req('DELETE'),ctx)).status,404);
 for(const method of ['POST','PATCH','DELETE'])assert.equal((await entries[method](req(method,{id:entry.id,type:'note',content:'bad'}),ctx)).status,404);
 assert.deepEqual((await (await list.GET(req('GET'))).json()).sessions,[]);
 fixture.user='owner-a';assert.equal((await single.PATCH(req('PATCH',{status:'done'}),ctx)).status,200);
 const now=Date.now();sql([{sql:"WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<499) INSERT INTO session_entries (id,session_id,owner_id,type,phase,content,created_at) SELECT 'seed-'||x,?,?,'note','other','seed',?+x FROM n",params:[session.id,'owner-a',now]}]);
 assert.equal((await entries.POST(req('POST',{type:'note',content:'over cap'}),ctx)).status,409);
 assert.equal((await entries.DELETE(req('DELETE',{id:entry.id}),ctx)).status,200);
 const outcomes=await Promise.all(Array.from({length:5},()=>entries.POST(req('POST',{type:'output',content:literal}),ctx)));assert.equal(outcomes.filter(r=>r.status===201).length,1);assert.equal(outcomes.filter(r=>r.status===409).length,4);
 const detail=await (await single.GET(req('GET'),ctx)).json();assert.equal(detail.entries.length,500);assert(detail.entries.every((e,i,a)=>!i||e.created_at>=a[i-1].created_at));
 fixture.fail=true;const failure=await single.GET(req('GET'),ctx);assert.equal(failure.status,503);assert(!(await failure.text()).includes('PRIVATE_DB_ERROR'));fixture.fail=false;
 assert.equal((await single.DELETE(req('DELETE'),ctx)).status,200);assert.equal(sql([{sql:'SELECT COUNT(*) n FROM session_entries WHERE session_id=?',params:[session.id]}])[0].results[0].n,0);
 assert.equal((await single.GET(req('GET'),ctx)).status,404);
 console.log('PASS: session owner/origin scoping, strict inputs, verbatim text, edit timestamps, atomic 500 cap, generic errors and migration cascade.');
} finally {delete globalThis.sessionFixture;await rm(directory,{recursive:true,force:true});}
