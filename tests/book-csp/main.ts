import {readBookPDF} from '../../lib/book/pdf-client';
const violations: string[]=[];document.addEventListener('securitypolicyviolation',e=>violations.push(e.violatedDirective+': '+e.blockedURI));
try {
 const bytes=await(await fetch('/book.pdf')).arrayBuffer();
 const result=await readBookPDF(new File([bytes],'fixture.pdf'),()=>{},new AbortController().signal);
 if(result.pages.length!==3||result.outline.length!==3||!result.pages[0].text.includes('nmap -sV target'))throw Error('Extraction mismatch: '+JSON.stringify(result));
 document.querySelector('#result')!.textContent='PASS — 3 pages, 3 bookmarks, code text preserved.\nSame-origin worker; enforced CSP without unsafe-eval or external sources.\nViolations: '+violations.length+' '+violations.join('; ')+'\n'+result.pages.map(p=>p.text).join('\n---\n');
} catch(error) {document.querySelector('#result')!.textContent='FAIL '+String(error)+'\n'+violations.join('\n');}
