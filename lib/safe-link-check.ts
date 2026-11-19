export type LinkStatus = 'ok' | 'redirect' | 'broken';
export function publicAddress(ip: string): boolean {
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  if (v4) {
    const [a,b,c,d] = v4.slice(1).map(Number);
    if ([a,b,c,d].some(v => v > 255)) return false;
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 || b === 0 || b === 2) || a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19 || b === 51) || a === 203 && b === 0 && c === 113);
  }
  // Fail closed outside global unicast IPv6, including IPv4-mapped and transition ranges.
  return /^[23][0-9a-f]{3}:[0-9a-f:]+$/i.test(ip) && !/^2001:(?:0*:|db8:|0*2:)/i.test(ip) && !/^2002:/i.test(ip);
}
export function resourceURL(value: string): URL {
  const url = new URL(value); const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443'
    || host === 'localhost' || host.endsWith('.localhost') || !host.includes('.') || /[\[\]:]/.test(host)
    || /^\d+(?:\.\d+)*$/.test(host) || /\.(?:local|internal|test|invalid|home|lan)$/.test(host)) throw Error('Blocked resource URL.');
  url.hostname = host; return url;
}
type DNSAnswer = { type: number; data: string };
export async function assertPublicDNS(host: string, signal: AbortSignal, fetcher: typeof fetch) {
  // Check both address families; any unsafe answer rejects the destination. CNAMEs are resolved by the trusted recursive resolver.
  const answers = await Promise.all(['A', 'AAAA'].map(async type => {
    const response = await fetcher('https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(host) + '&type=' + type,
      { headers: { Accept: 'application/dns-json' }, redirect: 'manual', signal });
    if (!response.ok) throw Error('DNS check failed.');
    const value = await response.json() as { Status: number; Answer?: DNSAnswer[] };
    if (value.Status !== 0) throw Error('DNS check failed.');
    return (value.Answer || []).filter(answer => answer.type === 1 || answer.type === 28).map(answer => answer.data);
  }));
  const addresses = answers.flat();
  if (!addresses.length || addresses.some(ip => !publicAddress(ip))) throw Error('Blocked DNS address.');
}
export async function checkHTTPS(value: string, fetcher: typeof fetch = fetch): Promise<{ status: LinkStatus; code?: number }> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 5000);
  try {
    let url = resourceURL(value); let redirects = 0;
    while (true) {
      await assertPublicDNS(url.hostname, controller.signal, fetcher);
      const response = await fetcher(url.href, { method: 'HEAD', redirect: 'manual', signal: controller.signal,
        headers: { 'User-Agent': 'Commonplace-Link-Check/1.0' } });
      await response.body?.cancel();
      if ([301,302,303,307,308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location || redirects >= 3) return { status: 'broken', code: response.status };
        url = resourceURL(new URL(location, url).href); redirects++; continue;
      }
      return { status: response.ok ? redirects ? 'redirect' : 'ok' : 'broken', code: response.status };
    }
  } catch { return { status: 'broken' }; } finally { clearTimeout(timer); }
}
