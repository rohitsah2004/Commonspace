import { getSiteSettings, siteUrl } from '../../../lib/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  const { securityContact } = await getSiteSettings();
  if (!securityContact) return new Response('Not configured', { status: 404 });
  const contact = securityContact.includes('@') && !securityContact.startsWith('https:') && !securityContact.startsWith('mailto:') ? 'mailto:' + securityContact : securityContact;
  return new Response(`Contact: ${contact}\nExpires: ${new Date(Date.now() + 365 * 86400000).toISOString()}\nCanonical: ${siteUrl()}/.well-known/security.txt\nPreferred-Languages: en\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
