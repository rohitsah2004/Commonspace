import type { Heading } from '../../lib/headings';
export function TableOfContents({ headings }: { headings: Heading[] }) {
  if (headings.length < 3) return null;
  return <details className="toc"><summary>On this page</summary><nav aria-label="Table of contents">{headings.map(h => <a className={h.level === 3 ? 'subheading' : ''} key={h.id} href={'#' + h.id}>{h.text}</a>)}</nav></details>;
}
