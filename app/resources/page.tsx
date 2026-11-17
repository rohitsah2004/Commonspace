import { TypeListing, type SearchParams } from '../components/listing';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Resources', description: 'Browse security resources.' };
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <TypeListing type="resource" params={await searchParams}/>;
}
