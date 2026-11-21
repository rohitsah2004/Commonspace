import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const cache = new Map();
async function moduleURL(file) {
  if (file.pathname.endsWith('/app/components/document-body.tsx')) return 'data:text/javascript,export const DocumentBody=()=>null';
  if (cache.has(file.href)) return cache.get(file.href);
  let code = ts.transpileModule(await readFile(file,'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.React}}).outputText;
  for (const match of [...code.matchAll(/from ["']([^"']+)["']/g)]) {
    const spec = match[1]; let target;
    if (spec === 'react') target = import.meta.resolve('react');
    else if (spec.startsWith('.')) { let path = new URL(spec,file); try { await readFile(path.href.endsWith('.ts')?path:new URL(path.href+'.ts')); path = path.href.endsWith('.ts')?path:new URL(path.href+'.ts'); } catch { path = new URL(path.href+'.tsx'); } target = await moduleURL(path); }
    if (target) code = code.replace(match[0], 'from '+JSON.stringify(target));
  }
  const url = 'data:text/javascript;base64,'+Buffer.from(code).toString('base64'); cache.set(file.href,url); return url;
}
const load = async path => import(await moduleURL(new URL('../lib/'+path,import.meta.url)));
const {cleanPages,detectChapters,pageCoverage,pageRanges} = await load('book/chapters.ts');
const pages = Array.from({length:80},(_,i)=>({number:i+1,text:`Book header\nPage-specific material ${i}\n${i+1}`,lines:[{text:'Book header',size:10},{text:`Page-specific material ${i}`,size:12},{text:String(i+1),size:10}]}));
const clean = cleanPages(pages);
assert(clean.every(p=>!p.text.includes('Book header')&&!p.lines.some(l=>l.text==='Book header')));
// Unique body lines must not be lost to numeric normalization: include enough body lines to keep them out of the margins.
const rich = pages.map(p=>({...p,text:['Book header','alpha','body '+p.number,'omega',String(p.number)].join('\n'),lines:['Book header','alpha','body '+p.number,'omega',String(p.number)].map(text=>({text,size:12}))}));
assert(cleanPages(rich).every(p=>p.text.includes('body '+p.number)));
for (const outline of [[],Array.from({length:80},(_,i)=>({title:'Chapter '+i,page:i+1,level:1})),[{title:'Start',page:5,level:1},{title:'End',page:60,level:1}]]) {
 const chapters=detectChapters(rich,outline);assert(chapters.length<=40);assert(pageCoverage(80,chapters,[]).complete);
}
assert.deepEqual(pageCoverage(4,[{startPage:1,endPage:2,included:true},{startPage:2,endPage:3,included:true}],[]).conflicts,[2]);
assert.deepEqual(pageCoverage(4,[{startPage:1,endPage:2,included:true}],[3,4]).unassigned,[]);
assert.equal(pageRanges([1,2,3,6,8,9]),'1–3, 6, 8–9');assert.equal(pageRanges([]),'');
const {chapterChunks,summaryGroups}=await load('book/chunks.ts');
const source=Array.from({length:65000},(_,i)=>String.fromCharCode(33+i%80)).join('');
const chunks=chapterChunks(source);let cursor=0;for(let i=0;i<chunks.length;i++){assert.equal(chunks[i],source.slice(cursor,cursor+15000));if(i<chunks.length-1)cursor+=14600;}assert.equal(cursor+chunks.at(-1).length,source.length);
const summaries=Array.from({length:30},(_,i)=>`${i}:`+'x'.repeat(1000));assert.deepEqual(summaryGroups(summaries).flat(),summaries);assert.throws(()=>summaryGroups(['x'.repeat(14001)]));
const {hasCopiedRun,missingSections,bookCodeWarnings}=await load('book/similarity.ts');
const words=Array.from({length:30},(_,i)=>'term'+i);assert(hasCopiedRun(words.join(' '),words.slice(0,25).join(' ')));assert(!hasCopiedRun(words.join(' '),words.slice(0,24).join(' ')));
assert.deepEqual(missingSections(['Network enumeration','Access control'],'Network enumeration is covered'),['Access control']);
assert.equal(bookCodeWarnings('nmap -sV host',[{tag:'pre',children:[{tag:'code',children:[{text:'nmap -sV host'}]}]}]).length,0);
assert.equal(bookCodeWarnings('nmap -sV host',[{tag:'pre',children:[{tag:'code',children:[{text:'nmap --invented host'}]}]}]).length,1);
const {generateChapter,saveBookJob,readBookJob,initialChapterState}=await load('book/job.ts');
const content=text=>({title:'Book note',subtitle:'',excerpt:'Fixture',type:'note',difficulty:'beginner',tags:[],cover:'',body:[{tag:'p',children:[{text}]}]});
const draft=text=>({content:content(text),warnings:[],longVerbatim:false});
const context={title:'Fixture',chapterTitle:'Chapter',chapterNumber:1,sections:['Network enumeration','Access control']};
let calls=[];const chapter={id:'test',title:'Chapter',startPage:1,endPage:1,text:'Network enumeration and Access control',chars:38,sections:context.sections,included:true};
const result=await generateChapter(chapter,context,async(mode,text,book)=>{calls.push({mode,text,book});return{items:[draft(calls.length===1?'Network enumeration':'Access control')]};},new AbortController().signal,()=>{});
assert.equal(calls.length,2);assert.deepEqual(result.gaps,[]);assert.equal(result.items.length,1);
calls=[];const long={...chapter,text:source,sections:[]};const longResult=await generateChapter(long,{...context,sections:[]},async(mode,text)=>{calls.push({mode,text});return mode==='book_chunk'?{content:content('summary '+calls.length)}:{items:[draft('Complete')]};},new AbortController().signal,()=>{});
assert.equal(longResult.chunksDone,chunks.length);assert.deepEqual(calls.filter(c=>c.mode==='book_chunk').map(c=>c.text),chunks);for(let i=1;i<=chunks.length;i++)assert(calls.at(-1).text.includes('summary '+i));
let stored='';globalThis.localStorage={setItem:(k,v)=>stored=v,getItem:()=>stored};const state={...initialChapterState(),text:'PRIVATE BOOK',warnings:['PRIVATE'],draftIds:['draft-1']};assert(saveBookJob({version:1,planHash:'hash',collectionId:'collection',chapters:[state]}));assert(!stored.includes('PRIVATE'));assert.equal(readBookJob('hash').chapters[0].draftIds[0],'draft-1');localStorage.getItem=()=>{throw Error('Blocked');};assert.equal(readBookJob('hash'),null);localStorage.setItem=()=>{throw Error('Blocked');};assert.equal(saveBookJob({chapters:[]}),false);delete globalThis.localStorage;
const {streamPDF,bookURL}=await load('book/fetch-pdf.ts');
for(const url of ['http://example.org/book.pdf','https://localhost/book.pdf','https://127.0.0.1/book.pdf','https://user:pass@example.org/book.pdf'])assert.throws(()=>bookURL(url));
const dns=url=>String(url).startsWith('https://cloudflare-dns.com/');let upstream=0;
const good=async(url,opts)=>{if(dns(url))return Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]});upstream++;assert.equal(opts.redirect,'manual');assert(!opts.headers.Cookie&&!opts.headers.Authorization);return new Response('%PDF-fixture',{headers:{'Content-Type':'application/pdf'}});};
const response=await streamPDF('https://example.org/book.pdf',new AbortController().signal,good);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(await response.text(),'%PDF-fixture');assert.equal(upstream,1);
await assert.rejects(()=>streamPDF('https://example.org/book.pdf',new AbortController().signal,async(url)=>dns(url)?Response.json({Status:0,Answer:[{type:1,data:'10.0.0.1'}]}):good(url)),/could not/);
await assert.rejects(()=>streamPDF('https://example.org/book.pdf',new AbortController().signal,async(url)=>dns(url)?good(url):new Response('<html>login',{headers:{'Content-Type':'text/html'}})),/web page/);
let hops=0;await assert.rejects(()=>streamPDF('https://example.org/book.pdf',new AbortController().signal,async(url)=>dns(url)?good(url):(hops++,new Response(null,{status:302,headers:{Location:'/next.pdf'}}))),/redirects/);assert.equal(hops,4);
await assert.rejects(()=>streamPDF('https://example.org/book.pdf',new AbortController().signal,async(url)=>dns(url)?good(url):new Response('%PDF-x',{headers:{'Content-Type':'application/pdf','Content-Length':String(61*1024*1024)}})),/60 MB/);
console.log('PASS: book page accounting, detection, chunk completeness, follow-up merge, copied passages, code checks, private recovery and guarded PDF relay.');

const {validateContent}=await load('content.tsx');const {contentToMarkdown}=await load('markdown.ts');const {parseMarkdown}=await load('markdown-parser.ts');
const sourced=validateContent({...content('Original'),sourceTitle:'Book',sourceAuthor:'Author',sourceUrl:'https://example.org/book'});assert.equal(parseMarkdown(contentToMarkdown(sourced)).metadata.sourceTitle,'Book');
for(const sourceUrl of ['javascript:alert(1)','http://example.org','https://user:password@example.org'])assert.throws(()=>validateContent({...content('Original'),sourceUrl}));
assert(!Object.hasOwn(validateContent(content('Old')), 'sourceTitle'));
const {saveBookDraft}=await load('book/api-client.ts');let posts=[],writes=[];const originalFetch=globalThis.fetch;
try {globalThis.fetch=async(url,options)=>{if(options.method==='GET')return Response.json({posts});const data=JSON.parse(options.body);writes.push({url,data});if(url==='/api/posts'){posts.push({id:'new-note',version:1,draft:data});return Response.json({id:'new-note'});}return Response.json({ok:true});};
 await saveBookDraft(draft('New'), 'collection-1',0,'Test Book',{sourceTitle:'Test Book'});
 await saveBookDraft(draft('Retry'), 'collection-1',0,'Test Book',{sourceTitle:'Test Book'});
 assert.equal(writes[0].url,'/api/posts');assert.equal(writes[1].data.action,'save');assert.equal(writes[1].data.version,1);assert.equal(writes.filter(w=>w.url==='/api/posts').length,1);assert(writes[0].data.tags.includes('chapter-1'));assert.equal(writes[0].data.series,'collection-1');assert(!writes.some(w=>['publish','schedule'].includes(w.data.action)));
} finally {globalThis.fetch=originalFetch;}
// Cap unknown-length responses while consuming, not just Content-Length headers.
const capped=await streamPDF('https://example.org/book.pdf',new AbortController().signal,async(url)=>dns(url)?good(url):new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('%PDF-'));for(let i=0;i<61;i++)c.enqueue(new Uint8Array(1024*1024));c.close();}}),{headers:{'Content-Type':'application/pdf'}}));
await assert.rejects(()=>capped.arrayBuffer(),/limit/);
console.log('PASS: optional source metadata, legacy compatibility, optimistic draft recovery and unknown-length streaming cap.');
