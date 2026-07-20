'use client';

import React from 'react';

/**
 * Full-featured Markdown renderer. Zero external dependencies.
 *
 * Block level: headings, tables, fenced code, blockquotes (nested blocks),
 *   ordered/unordered/task lists (nested), horizontal rules, paragraphs.
 * Inline level: **bold**, *italic* / _italic_, ***bold-italic***, `code`,
 *   ~~strikethrough~~, [links](url), ![images](url), bare autolinks.
 * Formatting is recursive — **bold *and italic*** works.
 */

// ═══════════════════════════════════════════════════════════════
// Shared style tokens
// ═══════════════════════════════════════════════════════════════

const S = {
  // paragraphs — first/last margins trimmed at the container level
  p: {
    margin: 0, lineHeight: 1.7,
    overflowWrap: 'break-word' as const, wordBreak: 'break-word' as const,
  },
  h: [
    { fontSize: '1.18rem', fontWeight: 700, lineHeight: 1.35, margin: 0 },
    { fontSize: '1.08rem', fontWeight: 700, lineHeight: 1.35, margin: 0 },
    { fontSize: '1rem',    fontWeight: 700, lineHeight: 1.4,  margin: 0 },
    { fontSize: '0.93rem', fontWeight: 700, lineHeight: 1.4,  margin: 0 },
    { fontSize: '0.88rem', fontWeight: 600, lineHeight: 1.4,  margin: 0 },
    { fontSize: '0.84rem', fontWeight: 600, lineHeight: 1.4,  margin: 0 },
  ] as const,
  inlineCode: {
    background: 'var(--paper-warm)', padding: '2px 6px', borderRadius: 4,
    fontSize: '0.85em', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: '#c6262e',
  },
  pre: {
    background: 'var(--paper-warm)', padding: '12px 14px', borderRadius: 7,
    fontSize: '0.81rem', lineHeight: 1.55,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const,
    border: '1px solid var(--border)',
  },
  blockquote: {
    borderLeft: '3px solid var(--accent)',
    padding: '2px 0 2px 14px', color: 'var(--ink-muted)',
  },
  hr: {
    border: 'none', borderTop: '1px solid var(--border)',
  },
  ul: {
    paddingLeft: 22, listStyleType: 'disc' as const, listStylePosition: 'outside' as const,
  },
  ol: {
    paddingLeft: 22, listStyleType: 'decimal' as const, listStylePosition: 'outside' as const,
  },
  li: {
    margin: '3px 0', lineHeight: 1.6,
  },
  th: {
    borderBottom: '2px solid var(--border)',
    padding: '7px 12px', textAlign: 'left' as const, fontWeight: 700,
    background: 'var(--paper-warm)',
  } as React.CSSProperties,
  td: {
    borderBottom: '1px solid var(--border)',
    padding: '6px 12px', verticalAlign: 'top' as const, lineHeight: 1.5,
  } as React.CSSProperties,
};

/** Vertical gap between sibling blocks inside a message bubble */
const BLOCK_GAP = 10;

// ═══════════════════════════════════════════════════════════════
// Inline formatter — recursive, handles nesting
// ═══════════════════════════════════════════════════════════════

// Tokens ordered by priority (code first — nothing inside it formats)
type InlineToken =
  | { kind: 'code'; raw: string; body: string }
  | { kind: 'image'; raw: string; alt: string; src: string }
  | { kind: 'link'; raw: string; text: string; href: string }
  | { kind: 'bold'; raw: string; body: string }
  | { kind: 'italic'; raw: string; body: string }
  | { kind: 'strike'; raw: string; body: string }
  | { kind: 'autolink'; raw: string; url: string }
  | { kind: 'text'; raw: string };

/**
 * Find the next (earliest) inline token in `src` starting from `pos`.
 * Returns null when nothing matches before end-of-string.
 */
function scanToken(src: string, pos: number): { token: InlineToken; index: number } | null {
  // 1. Inline code: `...`  (no newlines inside)
  const codeRe = /`([^`\n]+)`/g; codeRe.lastIndex = pos;
  const codeM = codeRe.exec(src);
  // 2. Image: ![alt](url)
  const imgRe = /!\[([^\]]*)\]\(([^)\s]+)\)/g; imgRe.lastIndex = pos;
  const imgM = imgRe.exec(src);
  // 3. Link: [text](url)
  const linkRe = /\[([^\]]*)\]\(([^)\s]+)\)/g; linkRe.lastIndex = pos;
  const linkM = linkRe.exec(src);

  // 4. Bold: **...** or __...__
  const boldRe = /\*\*(.+?)\*\*|__([^_]+)__/g; boldRe.lastIndex = pos;
  const boldM = boldRe.exec(src);
  // 5. Italic: *...* or _..._  (but NOT ** or __)
  const italicRe = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)([^_]+?)(?<!_)_(?!_)/g; italicRe.lastIndex = pos;
  const italicM = italicRe.exec(src);
  // 6. Strikethrough: ~~...~~
  const strikeRe = /~~(.+?)~~/g; strikeRe.lastIndex = pos;
  const strikeM = strikeRe.exec(src);
  // 7. Autolink (bare URL)
  const autoRe = /\bhttps?:\/\/[^\s<>\[\]()"']+/g; autoRe.lastIndex = pos;
  const autoM = autoRe.exec(src);

  const candidates: { index: number; token: InlineToken }[] = [];

  if (codeM)  candidates.push({ index: codeM.index,  token: { kind:'code',  raw: codeM[0],  body: codeM[1] } });
  if (imgM)   candidates.push({ index: imgM.index,   token: { kind:'image', raw: imgM[0],  alt: imgM[1], src: imgM[2] } });
  if (linkM)  candidates.push({ index: linkM.index,  token: { kind:'link',  raw: linkM[0],  text: linkM[1], href: linkM[2] } });
  if (boldM)  candidates.push({ index: boldM.index,  token: { kind:'bold',  raw: boldM[0],  body: boldM[2] || boldM[1] } });
  if (italicM) candidates.push({ index: italicM.index, token: { kind:'italic',raw: italicM[0], body: italicM[2] || italicM[1] } });
  if (strikeM) candidates.push({ index: strikeM.index, token: { kind:'strike',raw: strikeM[0],body: strikeM[1] } });
  if (autoM)  candidates.push({ index: autoM.index,  token: { kind:'autolink', raw: autoM[0], url: autoM[0] } });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.index - b.index);
  return candidates[0];
}

/**
 * Recursively render inline text — tokens inside bold/italic/strikethrough
 * are re-scanned for further formatting.
 */
function renderInline(src: string, keyPrefix: string): React.ReactNode {
  if (!src) return null;

  const nodes: React.ReactNode[] = [];
  let pos = 0;

  while (pos < src.length) {
    const result = scanToken(src, pos);
    if (!result) {
      // No more tokens — push remaining as plain text
      if (pos < src.length) {
        nodes.push(<React.Fragment key={`${keyPrefix}-t${pos}`}>{src.slice(pos)}</React.Fragment>);
      }
      break;
    }

    // Text gap before token
    if (result.index > pos) {
      nodes.push(<React.Fragment key={`${keyPrefix}-t${pos}`}>{src.slice(pos, result.index)}</React.Fragment>);
    }

    const token = result.token;
    const key = `${keyPrefix}-${result.index}`;

    switch (token.kind) {
      case 'code':
        nodes.push(<code key={key} style={S.inlineCode}>{token.body}</code>);
        break;
      case 'image':
        nodes.push(
          // eslint-disable-next-line @next/next/no-img-element
          <img key={key} src={token.src} alt={token.alt}
            style={{ maxWidth: '100%', height: 'auto', borderRadius: 5 }} />,
        );
        break;
      case 'link':
        nodes.push(
          <a key={key} href={token.href} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'underline', fontWeight: 500 }}>
            {renderInline(token.text, key)}
          </a>,
        );
        break;
      case 'bold':
        nodes.push(<strong key={key}>{renderInline(token.body, key)}</strong>);
        break;
      case 'italic':
        nodes.push(<em key={key}>{renderInline(token.body, key)}</em>);
        break;
      case 'strike':
        nodes.push(<del key={key}>{renderInline(token.body, key)}</del>);
        break;
      case 'autolink':
        nodes.push(
          <a key={key} href={token.url} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'underline', wordBreak: 'break-all' }}>
            {token.url}
          </a>,
        );
        break;
      default:
        nodes.push(token.raw);
    }
    pos = result.index + token.raw.length;
  }

  return <>{nodes}</>;
}

// ═══════════════════════════════════════════════════════════════
// Table helpers
// ═══════════════════════════════════════════════════════════════

function isTableRow(l: string) { return /^\s*\|/.test(l) && l.includes('|', 1); }
function isTableSep(l: string)   { return /^\s*\|[\s\-:]+\|/.test(l) && /-{3,}/.test(l); }

function parseTableCells(line: string): string[] {
  return line.split('|').slice(1, -1).map(c => c.trim());
}

function parseAligns(sep: string): ('left'|'center'|'right')[] {
  return sep.split('|').slice(1, -1).map(c => {
    const s = c.trim();
    if (s.startsWith(':') && s.endsWith(':')) return 'center';
    if (s.endsWith(':')) return 'right';
    return 'left';
  });
}

function renderTableBlock(rows: string[], key: number) {
  if (rows.length < 2) return <div key={key}>{rows.join('\n')}</div>;

  const headers = parseTableCells(rows[0]);
  const hasSep = isTableSep(rows[1]);
  const aligns = hasSep ? parseAligns(rows[1]) : headers.map(() => 'left' as const);
  const dataStart = hasSep ? 2 : 1;
  const ta = (a: string) => a === 'center' ? 'center' : a === 'right' ? 'right' : 'left';

  return (
    <div key={key} style={{ margin: `${BLOCK_GAP}px 0`, borderRadius: 6, border: '1px solid var(--border)', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
        <thead>
          <tr>
            {headers.map((h, ci) => (
              <th key={ci} style={{ ...S.th, textAlign: ta(aligns[ci]) as any }}>
                {renderInline(h, `th-${key}-${ci}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(dataStart).map((row, ri) => {
            const cells = parseTableCells(row);
            return (
              <tr key={ri}>
                {cells.map((cell, ci) => (
                  <td key={ci} style={{ ...S.td, textAlign: ta(aligns[ci]) as any }}>
                    {renderInline(cell, `td-${key}-${ri}-${ci}`)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// List helpers — single-pass grouping with nesting
// ═══════════════════════════════════════════════════════════════

type ListItem = {
  text: string;
  indent: number;
  ordered: boolean;
  orderNum?: number; // for ordered items
  checked?: boolean; // for task items
  children: ListItem[];
};

/**
 * Parse a sequence of list lines starting at `start`.
 * Returns [items, consumedLineCount].
 */
function parseListGroup(lines: string[], start: number): [ListItem[], number] {
  const items: ListItem[] = [];
  const baseIndent = (lines[start]?.length ?? 0) - (lines[start]?.trimStart().length ?? 0);
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (t === '') { i++; continue; }

    const indent = line.length - t.length;
    // Stop when indent returns to ≤ baseIndent and it's not a list item
    if (indent <= baseIndent) {
      const isListItem = /^[-*+]\s/.test(t) || /^\d+\.\s/.test(t);
      if (!isListItem) break;
    }

    const isUL = /^\s*[-*+]\s+/.test(line);
    const isOL = /^\s*\d+\.\s+/.test(line);

    if (isUL || isOL) {
      let text: string;
      let orderNum: number | undefined;
      let checked: boolean | undefined;

      if (isUL) {
        const m = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line);
        if (m) { checked = m[1].toLowerCase() === 'x'; text = m[2]; }
        else   { text = line.replace(/^\s*[-*+]\s+/, ''); }
      } else {
        const m = /^\s*(\d+)\.\s+(.*)$/.exec(line);
        orderNum = m ? parseInt(m[1], 10) : undefined;
        text = m ? m[2] : line.replace(/^\s*\d+\.\s+/, '');
      }

      // Peek ahead: gather children at deeper indent
      let consumed = 1; // this line
      let children: ListItem[] = [];
      let peek = i + 1;
      while (peek < lines.length) {
        const pt = lines[peek].trim();
        if (pt === '') { peek++; consumed++; continue; }
        const pIndent = (lines[peek]?.length ?? 0) - (lines[peek]?.trimStart().length ?? 0);
        if (pIndent > indent && (/^\s*[-*+]\s+/.test(lines[peek]) || /^\s*\d+\.\s+/.test(lines[peek]))) {
          const [childItems, childConsumed] = parseListGroup(lines, peek);
          children = childItems;
          peek += childConsumed;
          consumed += childConsumed;
          continue;
        }
        break;
      }

      items.push({ text, indent, ordered: !!isOL, orderNum, checked, children });
      i += consumed; // skip past children
    } else {
      i++; // shouldn't happen but safe
    }
  }
  return [items, i - start];
}

function renderListItems(items: ListItem[], key: number, isOrdered: boolean = false): React.ReactNode {
  if (isOrdered) {
    return (
      <ol style={S.ol}>
        {items.map((item, idx) => (
          <li key={idx} style={S.li}>
            {renderInline(item.text, `oli-${key}-${idx}`)}
            {item.children.length > 0 && (
              <div style={{ marginTop: 2, marginBottom: 0 }}>
                {renderListItems(item.children, key * 100 + idx, false)}
              </div>
            )}
          </li>
        ))}
      </ol>
    );
  }

  // Check if any item has a checkbox → render as task list
  const isTaskList = items.some(it => it.checked !== undefined);

  return (
    <ul style={isTaskList ? { ...S.ul, listStyleType: 'none', paddingLeft: 4 } : S.ul}>
      {items.map((item, idx) => (
        <li key={idx} style={S.li}>
          {item.checked !== undefined && (
            <span style={{ marginRight: 6, fontSize: '0.85rem', color: item.checked ? 'var(--green-text)' : 'var(--ink-muted)' }}>
              {item.checked ? '☑' : '☐'}
            </span>
          )}
          {renderInline(item.text, `ulli-${key}-${idx}`)}
          {item.children.length > 0 && (
            <div style={{ marginTop: 2, marginBottom: 0 }}>
              {renderListItems(item.children, key * 100 + idx, false)}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

// ═══════════════════════════════════════════════════════════════
// Block-quote — mini markdown inside
// ═══════════════════════════════════════════════════════════════

function renderQuote(lines: string[], start: number): [React.ReactNode, number] {
  const inner: string[] = [];
  let i = start;
  while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
    inner.push(lines[i].replace(/^\s*>\s?/, ''));
    i++;
  }
  return [
    <blockquote key={0} style={S.blockquote}>
      {/* Recursively render the inner content as mini-markdown */}
      <BlockList lines={inner} />
    </blockquote>,
    i - start,
  ];
}

// ═══════════════════════════════════════════════════════════════
// Block list — the core loop
// ═══════════════════════════════════════════════════════════════

function BlockList({ lines }: { lines: string[] }) {
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    // ── Fenced code ──
    if (t.startsWith('```')) {
      const lang = t.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push(
        <div key={key++} style={{ margin: `${BLOCK_GAP}px 0`, borderRadius: 7, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {lang && (
            <div style={{ padding: '3px 14px', fontSize: '0.68rem', color: 'var(--ink-faint)', background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {lang}
            </div>
          )}
          <pre style={{ ...S.pre, margin: 0, border: 'none', borderRadius: lang ? '0 0 7px 7px' : 7 }}>
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>,
      );
      continue;
    }

    // ── Table ──
    if (isTableRow(line)) {
      const rows: string[] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(lines[i]);
        i++;
      }
      blocks.push(renderTableBlock(rows, key++));
      continue;
    }

    // ── HR ──  (must come after table check)
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push(<hr key={key++} style={{ ...S.hr, margin: `${BLOCK_GAP}px 0` }} />);
      i++;
      continue;
    }

    // ── Heading ──
    const hM = /^(#{1,6})\s+(.*)$/.exec(line);
    if (hM) {
      const level = hM[1].length;
      const style = S.h[Math.min(level - 1, 5)];
      blocks.push(
        React.createElement(`h${Math.min(level, 6)}`, {
          key: key++,
          style: { ...style, margin: `${BLOCK_GAP + 4}px 0 2px`, color: level <= 2 ? 'var(--ink)' : 'var(--ink)' },
        }, renderInline(hM[2], `h${key}`)),
      );
      i++;
      continue;
    }

    // ── Blockquote ──
    if (/^\s*>\s?/.test(line)) {
      const [node, consumed] = renderQuote(lines, i);
      blocks.push(<div key={key++} style={{ margin: `${BLOCK_GAP}px 0` }}>{node}</div>);
      i += consumed;
      continue;
    }

    // ── Lists (ordered / unordered / task) ──
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const [items, consumed] = parseListGroup(lines, i);
      const isOL = items.length > 0 && items[0].ordered;
      blocks.push(
        <div key={key++} style={{ margin: `${BLOCK_GAP}px 0` }}>
          {renderListItems(items, key, isOL)}
        </div>,
      );
      i += consumed;
      continue;
    }

    // ── Blank ──
    if (t === '') { i++; continue; }

    // ── Paragraph ──
    const plines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trimStart().startsWith('```') &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*[-*+]\s/.test(lines[i]) &&
      !/^\s*\d+\.\s/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*(---|\*\*\*|___)\s*$/.test(lines[i]) &&
      !isTableRow(lines[i])
    ) {
      plines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} style={{ ...S.p, margin: `${BLOCK_GAP}px 0` }}>
        {plines.map((pl, pi) => (
          <React.Fragment key={pi}>
            {pi > 0 && <br />}
            {renderInline(pl, `p${key}-${pi}`)}
          </React.Fragment>
        ))}
      </p>,
    );
  }

  return <>{blocks}</>;
}

// ═══════════════════════════════════════════════════════════════
// Public component
// ═══════════════════════════════════════════════════════════════

export default function Markdown({ content }: { content: string }) {
  if (!content) return null;
  const lines = content.split('\n');
  return (
    <div style={{ fontSize: '0.875rem', lineHeight: 1.65, color: 'var(--ink)' }}>
      <BlockList lines={lines} />
    </div>
  );
}
