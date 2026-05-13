/* global React, Icon, PERSONAS */
const { useState } = React;

// ── Left rail — the Archive ────────────────────────────────────────
function Rail({ collapsed, onToggle, archives, activeArchive, onSelectArchive, persona, onOpenPersona, onOpenSettings }) {
  const [q, setQ] = useState('');
  const items = q
    ? archives.filter(a => (a.title + ' ' + a.summary).toLowerCase().includes(q.toLowerCase()))
    : archives;

  // Group by time bucket
  const grouped = groupByTime(items);

  const p = PERSONAS.find(x => x.id === persona) || PERSONAS[0];

  return (
    <aside className={`rail ${collapsed ? 'collapsed' : ''}`} aria-label="Archive">
      <div className="rail-toggle-wrap">
        <button className="icon-btn" onClick={onToggle} aria-label={collapsed ? 'Expand archive' : 'Collapse archive'}>
          <Icon.PanelLeft size={18}/>
        </button>
        {!collapsed ? (
          <div className="rail-search">
            <Icon.Search size={14}/>
            <input
              placeholder="Find a scroll…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            <kbd className="kbd">⌘K</kbd>
          </div>
        ) : null}
      </div>

      {collapsed ? (
        <div className="rail-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', padding: '8px 0' }}>
          <button className="icon-btn" title="New consultation"><Icon.Plus size={18}/></button>
          {archives.slice(0, 8).map(a => (
            <button
              key={a.id}
              className={`scroll-item ${a.id === activeArchive ? 'is-active' : ''}`}
              title={a.title}
              onClick={() => onSelectArchive?.(a.id)}
            >
              <Icon.Scroll size={16}/>
            </button>
          ))}
        </div>
      ) : (
        <div className="rail-scroll">
          {grouped.map(group => (
            <div key={group.label}>
              <div className="rail-eyebrow">{group.label}</div>
              {group.items.map(a => (
                <button
                  key={a.id}
                  className={`scroll-item ${a.id === activeArchive ? 'is-active' : ''}`}
                  onClick={() => onSelectArchive?.(a.id)}
                >
                  <div className="scroll-head">
                    <div className="scroll-mark"><Icon.Scroll size={14}/></div>
                    <div className="scroll-title">{a.title}</div>
                    <div className="scroll-time">{a.shortTime}</div>
                  </div>
                  <div className="scroll-summary">{a.summary}</div>
                </button>
              ))}
            </div>
          ))}
          {grouped.length === 0 ? (
            <div style={{ padding: '24px 16px', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--fg-3)', textAlign: 'center' }}>
              No scrolls match. Try a different word.
            </div>
          ) : null}
        </div>
      )}

      <div className="rail-foot">
        {!collapsed ? (
          <button className="persona-chip" onClick={onOpenPersona} title="Choose an oracle">
            <span className={`persona-avatar ${p.id}`}>{p.avatar}</span>
            <span style={{ textAlign: 'left' }}>
              <span className="persona-name" style={{ display: 'block', fontWeight: 600, fontSize: 13 }}>{p.name}</span>
              <span className="persona-role">{p.role}</span>
            </span>
            <Icon.ChevDown size={14} style={{ marginLeft: 'auto', color: 'var(--fg-3)' }}/>
          </button>
        ) : (
          <button className="icon-btn" onClick={onOpenPersona} title="Choose an oracle">
            <span className={`persona-avatar ${p.id}`} style={{ width: 22, height: 22 }}>{p.avatar}</span>
          </button>
        )}
        {!collapsed ? (
          <button className="icon-btn" onClick={onOpenSettings} title="Settings"><Icon.Cog size={16}/></button>
        ) : null}
      </div>
    </aside>
  );
}

function groupByTime(items) {
  const buckets = { 'Today': [], 'This week': [], 'Earlier': [] };
  items.forEach(a => {
    const t = a.timeAgo || '';
    if (/(minute|hour|today|just now)/i.test(t)) {
      buckets.Today.push({ ...a, shortTime: shortTime(t) });
    } else if (/(yesterday|day|days)/i.test(t)) {
      buckets['This week'].push({ ...a, shortTime: shortTime(t) });
    } else {
      buckets.Earlier.push({ ...a, shortTime: shortTime(t) });
    }
  });
  return Object.entries(buckets)
    .filter(([, arr]) => arr.length > 0)
    .map(([label, arr]) => ({ label, items: arr }));
}

function shortTime(t) {
  if (!t) return '';
  const m = t.match(/(\d+)\s+(min|hour|day|week|month)/);
  if (m) return `${m[1]}${m[2][0]}`;
  if (/yesterday/i.test(t)) return '1d';
  if (/today|now/i.test(t)) return 'now';
  return t.slice(0, 6);
}

Object.assign(window, { Rail });
