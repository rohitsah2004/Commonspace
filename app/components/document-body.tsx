import React from 'react';
import { safeURL, type DocNode } from '../../lib/content';
import { nodeText } from '../../lib/headings';
import { uniqueSlug } from '../../lib/slug';
import { tokenize } from '../../lib/highlight';
import { CodeBlock } from './copy-code';

export function DocumentBody({ nodes }: { nodes: DocNode[] }) {
  const seen = new Map<string, number>();
  function render(list: DocNode[]): React.ReactNode {
    return list.map((node, index) => {
      if (node.text !== undefined) return <React.Fragment key={index}>{node.text}</React.Fragment>;
      const children = node.children ?? [];
      if (node.tag === 'pre') {
        const text = nodeText(children); const language = node.language || 'text';
        return <CodeBlock key={index} text={text} language={language}>{tokenize(text, language).map((token, i) => <span key={i} className={token.kind === 'plain' ? undefined : 'syntax-' + token.kind}>{token.text}</span>)}</CodeBlock>;
      }
      if (node.tag === 'img') return <img key={index} src={safeURL(node.src || '', true)} alt={node.alt || 'Article illustration'} loading="lazy"/>;
      if (node.tag === 'h2' || node.tag === 'h3') {
        const text = nodeText(children); const id = uniqueSlug(text, seen);
        return React.createElement(node.tag, { key: index, id }, render(children), <a className="headinganchor" href={'#' + id} aria-label={'Link to ' + text}>#</a>);
      }
      return React.createElement(node.tag || 'p', { key: index, ...(node.tag === 'a' ? { href: safeURL(node.href || ''), target: '_blank', rel: 'noopener noreferrer' } : {}) }, node.tag === 'br' ? undefined : render(children));
    });
  }
  return <>{render(nodes)}</>;
}
