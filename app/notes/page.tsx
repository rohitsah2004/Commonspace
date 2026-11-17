import { TypeListing, type SearchParams } from '../components/listing';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notes', description: 'Browse security notes.' };
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <TypeListing type="note" params={await searchParams}/>;
}
