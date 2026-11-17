import { TypeListing, type SearchParams } from '../components/listing';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Posts', description: 'Browse security posts.' };
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <TypeListing type="post" params={await searchParams}/>;
}
