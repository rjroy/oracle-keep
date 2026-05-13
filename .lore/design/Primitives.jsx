/* global React */
const { useState, useEffect, useRef, useCallback, useMemo, Fragment } = React;

// ── Icons (Lucide-style, 1.75 stroke) ─────────────────────────────
const I = (d) => (props) => (
  <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24"
       fill="none" stroke="currentColor" strokeWidth={props.stroke || 1.75}
       strokeLinecap="round" strokeLinejoin="round" {...props}>
    {d}
  </svg>
);

const Icon = {
  Send:    I(<><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></>),
  Plus:    I(<><path d="M12 5v14"/><path d="M5 12h14"/></>),
  Search:  I(<><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>),
  Sun:     I(<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>),
  Moon:    I(<><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></>),
  Chev:    I(<><path d="M9 6l6 6-6 6"/></>),
  ChevDown:I(<><path d="M6 9l6 6 6-6"/></>),
  Lantern: I(<><path d="M9 3h6"/><path d="M10 3v3a4 4 0 0 0-4 4v9a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-9a4 4 0 0 0-4-4V3"/><path d="M12 11v5"/></>),
  Scroll:  I(<><path d="M8 3h11a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H8"/><path d="M16 21H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h11"/><path d="M8 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2"/><path d="M16 10a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2"/></>),
  Map:     I(<><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 17l9 4 9-4"/></>),
  Eye:     I(<><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></>),
  Globe:   I(<><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20"/><path d="M12 2a15 15 0 0 0 0 20"/></>),
  Compass: I(<><circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z"/></>),
  Book:    I(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>),
  Code:    I(<><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></>),
  Quill:   I(<><path d="M20 4c-7 1-13 7-15 17l3-3c2-1 5-1 7-3 3-3 5-7 5-11z"/><path d="M5 21l4-4"/></>),
  Sparkle: I(<><path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17.5 6.5 21 8 13.5 3 9l6.5-.5z"/></>),
  Menu:    I(<><path d="M3 6h18M3 12h18M3 18h18"/></>),
  PanelLeft: I(<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></>),
  Copy:    I(<><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>),
  Refresh: I(<><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></>),
  ThumbUp: I(<><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z"/></>),
  ThumbDn: I(<><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88z"/></>),
  Paperclip: I(<><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.83l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></>),
  Mic:     I(<><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></>),
  Shield:  I(<><path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3z"/></>),
  Crown:   I(<><path d="m2 18 4-12 6 6 6-6 4 12z"/><path d="M4 22h16"/></>),
  Tower:   I(<><path d="M7 22V11a5 5 0 0 1 10 0v11"/><path d="M5 22h14"/><path d="M9 11h6"/><path d="M12 4V2"/><path d="M10 2h4"/></>),
  Anvil:   I(<><path d="M3 10h12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/><path d="M9 13v3"/><path d="M5 19h8"/><path d="M14 10V6a2 2 0 0 1 2-2h3"/></>),
  Cog:     I(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.5 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8L4.2 7A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>),
  X:       I(<><path d="M18 6 6 18"/><path d="M6 6l12 12"/></>),
  ArrowRight: I(<><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>),
};

// ── Buttons ───────────────────────────────────────────────────────
function Button({ variant = "primary", icon: Ico, children, ...rest }) {
  return (
    <button className={`btn btn-${variant}`} {...rest}>
      {Ico ? <Ico size={16}/> : null}
      {children ? <span>{children}</span> : null}
    </button>
  );
}

function IconButton({ icon: Ico, label, isActive, ...rest }) {
  return (
    <button className={`icon-btn ${isActive ? 'is-active' : ''}`} aria-label={label} title={label} {...rest}>
      <Ico size={18}/>
    </button>
  );
}

// ── Markdown renderer — small, sufficient for our scripted content ─
// Supports: paragraphs, **bold**, *italic*, `code`, ```fenced code```,
// > blockquote, - unordered list, 1. ordered list, [text](href).
function renderInline(s) {
  // escape -> placeholder for code spans
  const codeRe = /`([^`]+)`/g;
  const parts = [];
  let last = 0; let m; let i = 0;
  while ((m = codeRe.exec(s)) !== null) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    parts.push(<code key={`c${i++}`}>{m[1]}</code>);
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push(s.slice(last));

  // now process bold/italic/links in remaining strings
  return parts.flatMap((part, pi) => {
    if (typeof part !== 'string') return [part];
    const out = [];
    let buf = part;
    // Links
    buf = buf.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, h) => `\x00L${out.push({t, h}) - 1}\x00`);
    // Bold
    buf = buf.replace(/\*\*([^*]+)\*\*/g, (_, t) => `\x00B${out.push({t}) - 1}\x00`);
    // Italic
    buf = buf.replace(/\*([^*]+)\*/g, (_, t) => `\x00I${out.push({t}) - 1}\x00`);
    // Tokenize on placeholders
    const tokens = buf.split(/(\x00[BIL]\d+\x00)/g);
    return tokens.map((tok, ti) => {
      const mm = tok.match(/\x00([BIL])(\d+)\x00/);
      if (!mm) return tok;
      const obj = out[+mm[2]];
      if (mm[1] === 'B') return <strong key={`${pi}-${ti}`}>{obj.t}</strong>;
      if (mm[1] === 'I') return <em key={`${pi}-${ti}`}>{obj.t}</em>;
      if (mm[1] === 'L') return <a key={`${pi}-${ti}`} href={obj.h} onClick={e => e.preventDefault()}>{obj.t}</a>;
      return tok;
    });
  });
}

function parseRow(line) {
  // strip leading/trailing pipes, then split, then trim each cell
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
}

function Markdown({ text, streaming }) {
  // Split into blocks by blank line, then handle fenced code separately
  const blocks = useMemo(() => {
    if (!text) return [];
    const out = [];
    const lines = text.split('\n');
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      // fenced code
      const fenceMatch = line.match(/^```(\w*)$/);
      if (fenceMatch) {
        const lang = fenceMatch[1] || 'text';
        const buf = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
          buf.push(lines[i]); i++;
        }
        i++; // skip closing fence
        out.push({ type: 'code', lang, content: buf.join('\n') });
        continue;
      }
      // blockquote
      if (line.startsWith('> ')) {
        const buf = [];
        while (i < lines.length && lines[i].startsWith('> ')) {
          buf.push(lines[i].slice(2)); i++;
        }
        out.push({ type: 'quote', content: buf.join(' ') });
        continue;
      }
      // unordered list
      if (/^[-*]\s+/.test(line)) {
        const buf = [];
        while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
          buf.push(lines[i].replace(/^[-*]\s+/, '')); i++;
        }
        out.push({ type: 'ul', items: buf });
        continue;
      }
      // ordered list
      if (/^\d+\.\s+/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
          buf.push(lines[i].replace(/^\d+\.\s+/, '')); i++;
        }
        out.push({ type: 'ol', items: buf });
        continue;
      }
      // heading h3
      if (/^###\s+/.test(line)) {
        out.push({ type: 'h3', content: line.replace(/^###\s+/, '') });
        i++; continue;
      }
      // table
      if (line.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        const head = parseRow(line);
        i += 2; // skip header + separator
        const rows = [];
        while (i < lines.length && lines[i].startsWith('|')) {
          rows.push(parseRow(lines[i]));
          i++;
        }
        out.push({ type: 'table', head, rows });
        continue;
      }
      // blank line
      if (!line.trim()) { i++; continue; }
      // paragraph: gather until blank
      const buf = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !/^(```|>|[-*]\s|\d+\.\s|###|\|)/.test(lines[i])) {
        buf.push(lines[i]); i++;
      }
      out.push({ type: 'p', content: buf.join(' ') });
    }
    return out;
  }, [text]);

  return (
    <div className={`prose ${streaming ? 'streaming' : ''}`}>
      {blocks.map((b, idx) => {
        if (b.type === 'code') return <pre key={idx} data-lang={b.lang}><code>{b.content}</code></pre>;
        if (b.type === 'quote') return <blockquote key={idx}>{renderInline(b.content)}</blockquote>;
        if (b.type === 'ul') return <ul key={idx}>{b.items.map((it, i) => <li key={i}>{renderInline(it)}</li>)}</ul>;
        if (b.type === 'ol') return <ol key={idx}>{b.items.map((it, i) => <li key={i}>{renderInline(it)}</li>)}</ol>;
        if (b.type === 'h3') return <h3 key={idx}>{renderInline(b.content)}</h3>;
        if (b.type === 'table') return (
          <div key={idx} className="prose-table-wrap">
            <table className="prose-table">
              <thead><tr>{b.head.map((c, i) => <th key={i}>{renderInline(c)}</th>)}</tr></thead>
              <tbody>
                {b.rows.map((r, ri) => (
                  <tr key={ri}>{r.map((c, ci) => <td key={ci}>{renderInline(c)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        return <p key={idx}>{renderInline(b.content)}</p>;
      })}
    </div>
  );
}

// ── Flourish divider ──────────────────────────────────────────────
function Flourish({ size = 200 }) {
  return (
    <svg viewBox="0 0 200 14" width={size} height="14" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M0 7 L80 7"/>
        <path d="M120 7 L200 7"/>
        <circle cx="100" cy="7" r="3"/>
        <path d="M92 7 L88 4 M92 7 L88 10 M108 7 L112 4 M108 7 L112 10"/>
      </g>
    </svg>
  );
}

Object.assign(window, { Icon, Button, IconButton, Markdown, Flourish, renderInline });
