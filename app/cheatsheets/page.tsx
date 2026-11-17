import { TypeListing, type SearchParams } from '../components/listing';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cheat sheets', description: 'Browse security cheat sheets.' };
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <TypeListing type="cheatsheet" params={await searchParams}/>;
}
