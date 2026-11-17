import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Import the real delivery workflow with in-memory D1/mail boundaries. No network or email credentials.
const state = { settings:new Map(), deliveries:[], sent:[], failOnce:true };
const subscribers = [
  {id:'confirmed-reader',email:'confirmed@example.invalid',status:'confirmed',created_at:1},
  {id:'pending-reader',email:'pending@example.invalid',status:'pending',created_at:1},
  {id:'unsubscribed-reader',email:'unsubscribed@example.invalid',status:'unsubscribed',created_at:1},
];
const pending = (through,id) => subscribers.filter(s => s.status === 'confirmed' && s.created_at <= through && !state.deliveries.some(d => d.post === id && d.subscriber === s.id));
const database = {
  prepare(sql) {
    let params = [];
    const statement = {
      bind(...values) { params = values; return statement; },
      async first() {
        if (sql.includes("key='digest:active'")) { const value=state.settings.get('digest:active');return value?{value}:null; }
        if (sql.includes("key='digest:last'")) { const value=state.settings.get('digest:last');return value?{value}:null; }
        if (sql.startsWith('SELECT id FROM subscribers')) return pending(...params)[0] || null;
        throw Error('Unexpected first query');
      },
      async all() { assert(sql.includes("status='confirmed'")); return {results:pending(...params).slice(0,10)}; },
      async run() {
        if (sql.includes("INSERT OR IGNORE INTO settings")) { if (!state.settings.has('digest:active')) state.settings.set('digest:active',params[0]); }
        else if (sql.startsWith('INSERT OR IGNORE INTO deliveries')) state.deliveries.push({post:params[1],subscriber:params[2]});
        else if (sql.includes("SELECT 'digest:last'")) { if(state.settings.get('digest:active')===params[1])state.settings.set('digest:last',params[0]); }
        else if (sql.startsWith('DELETE FROM settings')) { if(state.settings.get('digest:active')===params[0])state.settings.delete('digest:active'); }
        else throw Error('Unexpected run query');
      },
    }; return statement;
  },
  async batch(statements) { for (const statement of statements) await statement.run(); },
};
const now = Date.now();
const rows = [{row:{slug:'new-note',published_at:now-1000},content:{title:'New note',subtitle:'Summary',type:'note'}},
  {row:{slug:'old-post',published_at:1},content:{title:'Old post',subtitle:'Old',type:'post'}}];
state.settings.set('digest:last','2');
globalThis.digestMock = {database,rows,state};
const mocks = {
  './server': `export const database=()=>globalThis.digestMock.database;export const publicRows=async()=>globalThis.digestMock.rows;export const siteUrl=()=> 'https://example.invalid';export const getSiteSettings=async()=>({title:'Test publication'});`,
  './queries': 'export const parseRows=rows=>rows;',
  './types': "export const CONTENT_TYPES=['post','note','cheatsheet','resource'];export const TYPE_LABELS={post:{plural:'Posts'},note:{plural:'Notes'},cheatsheet:{plural:'Cheat sheets'},resource:{plural:'Resources'}};",
  './mail': `export const emailReady=()=>true;export const hash=async()=> 'test-signature';export async function mail(to,subject,text,key){const s=globalThis.digestMock.state;s.sent.push({to,subject,text,key});if(s.failOnce){s.failOnce=false;throw Error('Mock provider retry');}}`,
  'cloudflare:workers': 'export const env={RESEND_API_KEY:"fake-test-key"};',
};
let code=ts.transpileModule(await readFile(new URL('../lib/digest.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
for (const [name,source] of Object.entries(mocks)) code=code.replaceAll("from '"+name+"'",'from '+JSON.stringify('data:text/javascript;base64,'+Buffer.from(source).toString('base64')));
const {sendDigest}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
await assert.rejects(sendDigest(),/Mock provider retry/);
assert(state.settings.has('digest:active'));assert.equal(state.deliveries.length,0);
const result=await (await sendDigest()).json();assert.equal(result.sent,1);assert.equal(result.more,false);
assert.equal(state.sent.length,2);assert.equal(state.sent[0].key,state.sent[1].key);
assert(state.sent.every(m=>m.to==='confirmed@example.invalid' && m.text.includes('Unsubscribe:') && m.text.includes('New note') && !m.text.includes('Old post')));
assert.equal(state.deliveries.length,1);assert(!state.settings.has('digest:active'));
assert(Number(state.settings.get('digest:last'))>=now);
assert.equal((await (await sendDigest()).json()).sent,0);
delete globalThis.digestMock;
console.log('PASS: digest confirmed-only delivery, stable retry keys, frozen content, ledger and completion watermark with mocked mail.');
