import { Shell } from '../ui';
import { getTagCounts } from '../../lib/queries';
import { isOwner } from '../../lib/server';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tags', description: 'Browse security knowledge by topic.' };
export default async function Page() {
  const tags = await getTagCounts();
  return <Shell owner={await isOwner()}><div className="content"><h1>Follow your curiosity<span>.</span></h1><p>Browse every topic in the knowledge hub.</p><div className="tagcloud">{tags.map(tag => <a className="chip" href={'/tags/' + tag.slug} key={tag.slug}>{tag.label} <span>{tag.count}</span></a>)}</div>{!tags.length && <p>Tags will appear when the first item is published.</p>}</div></Shell>;
}
