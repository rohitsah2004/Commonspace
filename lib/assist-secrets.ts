// Heuristics, not a guarantee of detecting every secret. Never return matched values.
const patterns: [string, RegExp][] = [
  ['Private key', /-----BEGIN (?:[A-Z0-9 ]*PRIVATE KEY)-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['API token', /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g],
  ['Bearer token', /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi],
  ['Password or secret assignment', /\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*(?:"[^"\r\n]+"|'[^'\r\n]+'|[^\s,;]+)/gi],
  ['Private network address', /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g],
  ['Hash-like value', /\b(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})\b/gi],
];
export function secretWarnings(text: string): string[] {
  return patterns.filter(([, pattern]) => { pattern.lastIndex = 0; return pattern.test(text); }).map(([label]) => label);
}
export function redactSecrets(text: string): string {
  return patterns.reduce((value, [, pattern]) => { pattern.lastIndex = 0; return value.replace(pattern, '[REDACTED]'); }, text);
}
