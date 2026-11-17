import { TypeListing, type SearchParams } from '../../components/listing';
import { normalizeTag } from '../../../lib/slug';
import { siteUrl } from '../../../lib/server';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }) {
  const tag = normalizeTag((await params).tag);
  return { title: `${tag} knowledge`, description: `Posts, notes, cheat sheets and resources tagged ${tag}.`, alternates: { canonical: siteUrl() + '/tags/' + tag } };
}
export default async function Page({ params, searchParams }: { params: Promise<{ tag: string }>; searchParams: Promise<SearchParams> }) {
  return <TypeListing forcedTag={normalizeTag((await params).tag)} params={await searchParams}/>;
}
