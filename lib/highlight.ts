export const CODE_LANGUAGES = ['javascript', 'typescript', 'python', 'json', 'bash', 'powershell', 'sql', 'yaml', 'kql', 'http', 'dockerfile', 'go', 'rust', 'c', 'java', 'html', 'css', 'regex', 'ini', 'diff', 'text'] as const;
export type CodeLanguage = typeof CODE_LANGUAGES[number];
export type Token = { text: string; kind: 'plain' | 'comment' | 'string' | 'keyword' | 'number' | 'variable' | 'addition' | 'deletion' };
const words: Record<string, string> = {
  javascript: 'const let var function return if else import from export async await class new true false null undefined throw try catch typeof instanceof for of in while switch case break this',
  typescript: 'const let var function return if else import from export async await class new true false null undefined interface type extends implements public private readonly string number boolean unknown never as satisfies',
  python: 'def return if elif else import from as class True False None for in while try except finally with lambda yield async await pass raise and or not is',
  powershell: 'param function return if elseif else foreach in while switch try catch finally throw begin process end filter true false null',
  sql: 'select from where join inner left right on as group by order having limit offset insert into values update set delete create table index and or not null case when then end distinct union',
  kql: 'where summarize extend project project-away project-rename join kind on by let union take limit top order sort asc desc count distinct render parse evaluate has contains in between ago datetime true false',
  bash: 'if then else elif fi for do done while case esac function in export local return exit source',
  dockerfile: 'from run copy add workdir env arg expose cmd entrypoint user volume label onbuild shell healthcheck',
  go: 'package import func return if else for range go defer select case switch type struct interface map chan const var true false nil',
  rust: 'fn let mut pub use mod impl trait struct enum match if else for in loop while return self Self true false None Some async await move',
  c: 'int char float double void const static struct enum typedef if else for while return switch case break sizeof include define',
  java: 'public private protected class interface static final void int long double boolean new return if else for while try catch throw throws import package extends implements true false null',
  yaml: 'true false null yes no', json: 'true false null', css: 'important inherit initial unset none auto',
};
const hashComments = new Set(['python', 'powershell', 'bash', 'yaml', 'dockerfile', 'ini']);
const slashComments = new Set(['javascript', 'typescript', 'go', 'rust', 'c', 'java', 'kql', 'css']);

/** A bounded forward scanner: language-specific comments cannot consume strings or JS private fields. */
export function tokenize(text: string, language: string): Token[] {
  if (!CODE_LANGUAGES.includes(language as CodeLanguage) || language === 'text') return [{ text, kind: 'plain' }];
  const keywords = new Set((words[language] ?? '').split(' '));
  const tokens: Token[] = [];
  const add = (value: string, kind: Token['kind']) => {
    const last = tokens[tokens.length - 1];
    if (last?.kind === kind) last.text += value;
    else tokens.push({ text: value, kind });
  };
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const lineStart = i === 0 || text[i - 1] === '\n';
    if (language === 'diff' && lineStart && (text[i] === '+' || text[i] === '-')) {
      const end = text.indexOf('\n', i); const stop = end < 0 ? text.length : end;
      add(text.slice(i, stop), text[i] === '+' ? 'addition' : 'deletion'); i = stop; continue;
    }
    const lineComment = hashComments.has(language) && text[i] === '#' && (language !== 'yaml' || i === 0 || /\s/.test(text[i - 1]))
      || slashComments.has(language) && rest.startsWith('//') && language !== 'css'
      || language === 'sql' && rest.startsWith('--') || language === 'ini' && text[i] === ';';
    if (lineComment) {
      const end = text.indexOf('\n', i); const stop = end < 0 ? text.length : end;
      add(text.slice(i, stop), 'comment'); i = stop; continue;
    }
    const block = slashComments.has(language) && rest.startsWith('/*') ? '*/' : language === 'html' && rest.startsWith('<!--') ? '-->' : '';
    if (block) {
      const end = text.indexOf(block, i + 2); const stop = end < 0 ? text.length : end + block.length;
      add(text.slice(i, stop), 'comment'); i = stop; continue;
    }
    if (['"', "'", '`'].includes(text[i]) && language !== 'diff') {
      const quote = text[i]; let end = i + 1;
      while (end < text.length) { if (text[end] === '\\') { end += 2; continue; } if (text[end++] === quote) break; }
      end = Math.min(end, text.length); add(text.slice(i, end), 'string'); i = end; continue;
    }
    const variable = (language === 'powershell' || language === 'bash') && rest.match(/^\$[A-Za-z_][\w:]*/);
    if (variable) { add(variable[0], 'variable'); i += variable[0].length; continue; }
    const number = /[\w]/.test(text[i - 1] ?? '') ? null : rest.match(/^(?:0x[\da-fA-F]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i);
    if (number) { add(number[0], 'number'); i += number[0].length; continue; }
    const word = rest.match(/^[A-Za-z_][\w-]*/);
    if (word) {
      add(word[0], keywords.has(word[0].toLowerCase()) || keywords.has(word[0]) ? 'keyword' : 'plain'); i += word[0].length; continue;
    }
    add(text[i], 'plain'); i++;
  }
  return tokens;
}
