/* global React, Icon, Markdown, PERSONAS, TOOLS */
const { useState } = React;

// ── Tool card (collapsed by default) ────────────────────────────────
function ToolCard({ call, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const tool = TOOLS[call.tool] || { name: call.tool, desc: '', icon: 'Code' };
  const Ico = Icon[tool.icon] || Icon.Code;
  const isActive = call.status === 'pending';

  return (
    <div className={`tool-card ${open ? 'is-open' : ''} ${isActive ? 'is-active' : ''}`}>
      <div className="tool-card-head" onClick={() => setOpen(!open)} role="button" tabIndex={0}>
        <div className="tool-icon-wrap"><Ico size={16}/></div>
        <div className="tool-card-body-wrap">
          <div className="tool-card-name">{tool.name}</div>
          <div className="tool-card-sub">
            {call.status === 'pending' ? (call.pendingText || 'unrolling the maps…') : tool.desc}
            {call.result?.summary && call.status === 'done' ? ` · ${call.result.summary}` : ''}
          </div>
        </div>
        <span className={`tool-card-status ${call.status}`}>
          {call.status === 'pending' ? 'in progress' : call.status === 'done' ? 'returned' : 'failed'}
        </span>
        <Icon.Chev size={14} className="tool-card-chev"/>
      </div>

      {open ? (
        <div className="tool-card-body">
          {call.args ? <ToolArgs args={call.args}/> : null}
          {call.status === 'done' && call.result ? <ToolResult result={call.result}/> : null}
          {call.status === 'pending' ? (
            <div className="shimmer" style={{ height: 18, borderRadius: 6 }}/>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ToolArgs({ args }) {
  // Pretty-print with JSON-like coloring
  const pretty = JSON.stringify(args, null, 2);
  return (
    <div>
      <div className="tool-section-title">Arguments</div>
      <pre className="tool-args"><code>{colorizeJson(pretty)}</code></pre>
    </div>
  );
}

function colorizeJson(s) {
  // Split into spans by simple regex pass
  const out = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)|("(?:\\.|[^"\\])*")|(\b\d+(?:\.\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)/g;
  let last = 0; let m; let k = 0;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1]) { out.push(<span key={k++} className="key">{m[1]}</span>); out.push(m[2]); }
    else if (m[3]) out.push(<span key={k++} className="str">{m[3]}</span>);
    else if (m[4]) out.push(<span key={k++} className="num">{m[4]}</span>);
    else if (m[5]) out.push(<span key={k++} className="num">{m[5]}</span>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function ToolResult({ result }) {
  return (
    <div>
      <div className="tool-section-title">Returned</div>
      <div className="tool-result">
        {result.sources ? (
          <div>
            {result.sources.map(s => (
              <div className="source" key={s.n}>
                <div className="source-num">{s.n}</div>
                <div>
                  <div className="source-title">{s.title}</div>
                  <div className="source-domain">{s.domain}{s.date ? ` · ${s.date}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {result.markdown ? <Markdown text={result.markdown}/> : null}
        {result.text ? <p style={{ margin: 0 }}>{result.text}</p> : null}
      </div>
    </div>
  );
}

// ── User message ───────────────────────────────────────────────────
function UserMessage({ item, you }) {
  return (
    <div className="msg">
      <div className="msg-avatar user">{(you?.[0] || 'W').toUpperCase()}</div>
      <div className="msg-body">
        <div className="msg-head">
          <span className="msg-name">{you || 'Wren'}</span>
          <span className="msg-role">you</span>
          <span className="msg-time">{item.timeAgo}</span>
        </div>
        <Markdown text={item.text}/>
      </div>
    </div>
  );
}

// ── Oracle message (with optional tool calls + actions) ────────────
function OracleMessage({ item, streaming }) {
  const p = PERSONAS.find(x => x.id === (item.persona || 'oracle')) || PERSONAS[0];
  return (
    <div className="msg">
      <div className={`msg-avatar ${p.id}`}>{p.avatar}</div>
      <div className="msg-body">
        <div className="msg-head">
          <span className="msg-name">{p.name}</span>
          <span className="msg-role">{p.role.toLowerCase()}</span>
          <span className="msg-time">{item.timeAgo}</span>
        </div>

        {item.toolCalls?.map((tc, i) => (
          <ToolCard key={tc.id || i} call={tc}/>
        ))}

        {item.text ? (
          <div style={{ marginTop: item.toolCalls?.length ? 12 : 0 }}>
            <Markdown text={item.text} streaming={streaming}/>
          </div>
        ) : null}

        {!streaming ? (
          <div className="msg-actions">
            <button className="msg-action" title="Copy"><Icon.Copy size={12}/> Copy</button>
            <button className="msg-action" title="Regenerate"><Icon.Refresh size={12}/> Try again</button>
            <button className="msg-action" title="Useful"><Icon.ThumbUp size={12}/></button>
            <button className="msg-action" title="Not quite"><Icon.ThumbDn size={12}/></button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Archive card (compaction marker) ───────────────────────────────
function ArchiveCard({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="archive-mark">
        <Icon.Scroll size={14} className="scroll-icon"/>
        <span>The archivist condensed</span>
      </div>
      <div className="archive-card" style={{ marginTop: 10 }}>
        <div className="archive-card-head">
          <Icon.Scroll size={12}/>
          <span>{item.title}</span>
          <span className="meta">{item.timeAgo} · {item.turns} turns</span>
        </div>
        <p className="archive-card-summary">{item.summary}</p>
        <button className="archive-card-expand" onClick={() => setOpen(!open)}>
          {open ? 'Fold the scroll' : 'Unroll the scroll'}
          <Icon.Chev size={12} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 200ms' }}/>
        </button>
        {open && item.detail ? (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--rule-soft)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {item.detail.map((d, i) => (
              <div key={i} style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.55 }}>
                <strong style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: d.who === 'you' ? 'var(--fg-1)' : 'var(--ember-700)', marginRight: 8 }}>
                  {d.who === 'you' ? 'You' : 'Oracle'}
                </strong>
                {d.text}
              </div>
            ))}
            <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 12, color: 'var(--fg-3)' }}>
              …and {item.turns - (item.detail?.length || 0)} more, kept in the archive.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

Object.assign(window, { UserMessage, OracleMessage, ArchiveCard, ToolCard });
