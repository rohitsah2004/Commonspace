import {safeURL} from './url';
import {DOCUMENT_TAGS} from './document-schema';
import {CODE_LANGUAGES} from './highlight';import {DocumentBody} from '../app/components/document-body';
import type { ContentMetadata } from './types';import { validateMetadata } from './content-metadata';
import React from 'react';
export type DocNode={tag?:string;text?:string,href?:string,src?:string,alt?:string,language?:string,children?:DocNode[]};
export type Content=ContentMetadata & {title:string,subtitle:string,cover:string,tags:string[],body:DocNode[],series?:string,position?:number,attachments?:{id:string,name:string,url:string,size:number,type:string}[]};
const tags=DOCUMENT_TAGS;
export const blank=():Content=>({title:'',subtitle:'',cover:'',tags:[],body:[],type:'post',difficulty:''});
export {safeURL} from './url';

export function validateContent(value:any):Content{
 if(!value||typeof value.title!=='string'||!value.title.trim()||value.title.length>200)throw Error('Add a title of up to 200 characters.');
 if(typeof value.subtitle!=='string'||value.subtitle.length>500||typeof value.cover!=='string'||value.cover.length>2048)throw Error('The subtitle or cover link is too long.');
 if(value.cover&&!safeURL(value.cover,true))throw Error('Use an uploaded image or an HTTPS image link.');
 if(!Array.isArray(value.tags)||value.tags.length>8||value.tags.some((t:any)=>typeof t!=='string'||t.length>40))throw Error('Use up to 8 topics, each up to 40 characters.');
 let total=0;function nodes(list:any,depth=0):DocNode[]{if(!Array.isArray(list)||depth>25)throw Error('The document structure is too complex.');return list.map(n=>{if(++total>12000||!n||typeof n!=='object')throw Error('The document is too large.');if(typeof n.text==='string'){if(n.text.length>150000)throw Error('The document is too large.');return {text:n.text}}if(!tags.has(n.tag))throw Error('Unsupported text formatting.');const out:DocNode={tag:n.tag};if(n.tag==='pre')out.language=CODE_LANGUAGES.includes(n.language)?n.language:'text';if(n.tag==='a'){out.href=safeURL(n.href||'');if(!out.href)throw Error('Use an HTTP or HTTPS link.')}if(n.tag==='img'){out.src=safeURL(n.src||'',true);out.alt=String(n.alt||'').slice(0,300);if(!out.src)throw Error('Use an uploaded image or an HTTPS image link.')}out.children=nodes(n.children||[],depth+1);return out})}
 const attachments=Array.isArray(value.attachments)?value.attachments:[];if(attachments.length>12||attachments.some((a:any)=>!a||typeof a.id!=='string'||typeof a.name!=='string'||a.name.length>200||a.url!=='/files/'+a.id||typeof a.size!=='number'||typeof a.type!=='string'))throw Error('Invalid attachment.');if(value.series&&typeof value.series!=='string')throw Error('Invalid collection.');const body=nodes(value.body);if(JSON.stringify(body).length>600000)throw Error('This post is too large.');return {...validateMetadata(value,safeURL),title:value.title.trim(),subtitle:value.subtitle.trim(),cover:safeURL(value.cover,true),tags:[...new Set(value.tags.map((t:string)=>t.trim()).filter(Boolean))] as string[],body,series:(value.series||'').slice(0,100),position:Math.max(0,Math.min(1000,Number(value.position)||0)),attachments:attachments.map((a:any)=>({id:a.id,name:a.name,url:a.url,size:a.size,type:a.type}))};
}
export function plainText(nodes:DocNode[]):string{return nodes.map(n=>n.text??plainText(n.children||[])).join(' ')}
export function readingTime(c:Content){return Math.max(1,Math.ceil(plainText(c.body).split(/\s+/).filter(Boolean).length/220))}
export function RichBody({nodes}:{nodes:DocNode[]}){return <DocumentBody nodes={nodes}/>;}
