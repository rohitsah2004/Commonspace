export const PUBLIC_HOST_ALLOWLIST = ['github.com', 'githubusercontent.com', 'exploit-db.com', 'nmap.org'];
const FILE_EXTENSIONS = new Set('sh py txt conf php js ts tsx jsx json yaml yml xml ini cfg md csv zip exe dll so c h go rs ps1 html htm css sql rb pl pem key crt bat cmd bak pdf png jpg jpeg svg log toml lock tar gz tgz bz2 xz 7z iso pcap pcapng db sqlite bin doc docx xls xlsx ppt pptx mp3 mp4 mov wasm deb rpm'.split(' '));
export function suggestedBareHost(name: string): string {
  const end = name.replace(/\s*\([^)]*\)\s*$/, '').trim().split(/\s*[-–—:/]\s+|\s+/).at(-1) || '';
  return /^[a-z][a-z0-9_-]{0,62}$/i.test(end) ? end.toLowerCase() : '';
}
export function parseBareHosts(input: string): string[] {
  const values = [...new Set(input.split(/[\s,]+/).filter(Boolean).map(value => value.toLowerCase()))];
  if (values.length > 50 || values.some(value => !/^[a-z][a-z0-9_-]{0,62}$/.test(value))) throw Error('Enter up to 50 bare names, starting with a letter, separated by commas or spaces.');
  return values;
}
function ipv4(value: string): string | null {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return null;
  const parts = value.split('.').map(Number); return parts.every(n => n <= 255) ? parts.join('.') : null;
}
function ipv6(value: string): string | null {
  let raw = value.replace(/^\[|\]$/g, '').toLowerCase();
  if (!raw.includes(':') || raw.includes(':::') || raw.split('::').length > 2 || /[^a-f0-9:.]/.test(raw)) return null;
  if (raw.includes('.')) {
    const tail = raw.slice(raw.lastIndexOf(':') + 1), v4 = ipv4(tail); if (!v4) return null;
    const [a,b,c,d] = v4.split('.').map(Number); raw = raw.slice(0, raw.lastIndexOf(':') + 1) + ((a << 8) + b).toString(16) + ':' + ((c << 8) + d).toString(16);
  }
  const halves = raw.split('::'); const groups = halves.flatMap(h => h ? h.split(':') : []);
  if (groups.some(g => !/^[a-f0-9]{1,4}$/.test(g)) || (halves.length === 1 ? groups.length !== 8 : groups.length >= 8)) return null;
  const expanded = halves.length === 1 ? groups : [...(halves[0] ? halves[0].split(':') : []), ...Array(8 - groups.length).fill('0'), ...(halves[1] ? halves[1].split(':') : [])];
  return expanded.map(g => parseInt(g, 16).toString(16)).join(':');
}
/** One-way, request-local replacement. No mapping or originals leave this function. */
export function maskSessionTargets(text: string, bareNames: string[] = []): string {
  const bare = new Set(parseBareHosts(bareNames.join(','))); const hosts = new Map<string, string>(), ips = new Map<string, string>();
  const placeholder = (map: Map<string, string>, key: string, prefix: string) => {
    if (!map.has(key)) map.set(key, '<' + prefix + '_' + (map.size + 1) + '>');
    return map.get(key)!;
  };
  function host(value: string, allowBare: boolean) {
    const key = value.toLowerCase().replace(/\.$/, '');
    const ip = ipv4(key) || ipv6(key); if (ip) return placeholder(ips, ip, 'TARGET_IP');
    if (PUBLIC_HOST_ALLOWLIST.some(allowed => key === allowed || key.endsWith('.' + allowed))) return value;
    if (key.includes('.')) {
      if (FILE_EXTENSIONS.has(key.split('.').at(-1)!) || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/i.test(key)) return value;
      return placeholder(hosts, key, 'HOST');
    }
    return allowBare && bare.has(key) ? placeholder(hosts, key, 'HOST') : value;
  }
  function outsideURLs(part: string) {
    // Work within shell/prose tokens so a bare word inside a path or flag is never changed.
    return part.replace(/\S+/g, token => token.replace(/\[[a-f0-9:.]+\]|(?:[a-f0-9]*:){2,}[a-f0-9:.]*|[a-z0-9_-]+(?:\.[a-z0-9_-]+)+|[a-z0-9_-]+/gi, (value, offset: number) => {
      const ip = ipv4(value) || ipv6(value);
      if (ip) return placeholder(ips, ip, 'TARGET_IP');
      const before = token.slice(0, offset), after = token.slice(offset + value.length);
      const whole = /^[('"`\[{]*$/.test(before) && /^[)\]'"`},.!?;:]*$/.test(after);
      if (!value.includes('.')) return host(value, whole);
      // Dotted targets can have a port/CIDR; path components and flag names are excluded.
      if (/[\\/]/.test(before) || before.startsWith('--') && !before.includes('=')) return value;
      return host(value, false);
    }));
  }
  let out = '', at = 0;
  const urls = /\b[a-z][a-z0-9+.-]*:\/\/[^\s<>"'`]+/gi;
  for (const match of text.matchAll(urls)) {
    out += outsideURLs(text.slice(at, match.index));
    const parsed = /^([a-z][a-z0-9+.-]*:\/\/)([^/?#]*)([\s\S]*)$/i.exec(match[0]);
    if (!parsed) out += match[0];
    else {
      const authority = /^(.*@)?(\[[^\]]+\]|[^:]*)(:\d+)?$/.exec(parsed[2]);
      out += authority ? parsed[1] + (authority[1] || '') + host(authority[2], true) + (authority[3] || '') + parsed[3].replace(/\[[a-f0-9:.]+\]|(?:[a-f0-9]*:){2,}[a-f0-9:.]*|\d{1,3}(?:\.\d{1,3}){3}/gi, value => { const ip = ipv4(value) || ipv6(value); return ip ? placeholder(ips, ip, 'TARGET_IP') : value; }) : match[0];
    }
    at = match.index! + match[0].length;
  }
  return out + outsideURLs(text.slice(at));
}
