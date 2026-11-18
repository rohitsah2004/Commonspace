import { Shell } from '../ui';
import { FeedLink } from '../components/feed-link';
import { siteUrl } from '../../lib/server';

export const dynamic = 'force-dynamic';
export function generateMetadata() {
  return { title: 'Follow with RSS', description: 'Follow new posts in your feed reader without sharing your email address.',
    alternates: { canonical: siteUrl() + '/follow' } };
}
export default function FollowPage() {
  const feed = siteUrl() + '/feed.xml';
  return <Shell><div className="content rss-follow">
    <a href="/" className="backlink">← Back to stories</a>
    <div className="eyebrow"><span/>READ AT YOUR OWN PACE</div>
    <h1>Follow with RSS<span>.</span></h1>
    <p>Get new posts in your feed reader, alongside the other websites you follow. No email address or account on this site is needed.</p>
    <section className="toolpanel"><h2>Your subscription link</h2><p>Copy this address into your RSS reader to follow the publication.</p><FeedLink url={feed}/></section>
    <section className="toolpanel prose"><h2>How to follow</h2><ol>
      <li>Open an RSS reader app on your phone or computer.</li>
      <li>Choose its option to add a feed or follow a website.</li>
      <li>Paste the feed address above and confirm.</li>
    </ol><p>New published posts appear when your reader refreshes the feed. You can stop following at any time in your reader.</p></section>
    <section className="toolpanel"><h2>Why did the feed look like code?</h2><p>The raw RSS feed is XML data designed for feed readers. Seeing code in a browser is normal; this page helps you use that address.</p>
      <a className="chip" href="/feed.xml">View raw RSS (XML) ↗</a>
    </section>
  </div></Shell>;
}
