import { siteUrl } from '../../lib/server';
export async function GET() { return Response.redirect(siteUrl() + '/.well-known/security.txt', 308); }
